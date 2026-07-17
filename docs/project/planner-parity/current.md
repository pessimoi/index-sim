# Legacy Planner parity audit

- Status: classified
- Evidence date: 2026-07-10
- Cases: 16
- Comparisons: 32
- Matches: 0
- Differences: 32
- Runtime policy: archived Planner is comparison evidence; the Revision 274 rewrite remains product truth

## Classification summary

- match: 0
- accepted-rewrite-delta: 29
- legacy-defect: 0
- source-data-delta: 3
- rewrite-gap: 0
- not-representable: 0
- needs-review: 0

## Gate status

- Baseline valid: yes
- Missing baseline rows: none
- Unexpected baseline rows: none
- Stale baseline rows: none
- Needs review: none
- Approved rewrite gaps: none

## Comparisons

### boosted_sustained_strength_path / current-product

Boosted sustained melee training remains deterministic on the V1 rewrite path.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: strength -> strength
- Rewrite step order: strength -> strength
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `d0654477d147ca84`
- Rewrite digest: `14e56a0519eccbab`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 1       |

### boosted_sustained_strength_path / reference-context

Boosted sustained melee training remains deterministic on the V1 rewrite path.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: strength -> strength
- Rewrite step order: strength -> strength
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `d0654477d147ca84`
- Rewrite digest: `7b961f1dbc8d3832`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 3       |

### current_gear_lock / current-product

Current-gear lock prevents an otherwise eligible weapon replacement.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: attack -> attack
- Rewrite step order: attack -> attack
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `19835253eed06326`
- Rewrite digest: `2234f7b7485429be`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 1       |

### current_gear_lock / reference-context

Current-gear lock prevents an otherwise eligible weapon replacement.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: attack -> attack
- Rewrite step order: attack -> attack
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `19835253eed06326`
- Rewrite digest: `51130e7357581ac6`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 3       |

### locked_attack_strength_training / current-product

A current-level Attack target locks Attack while Strength advances.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: strength -> strength
- Rewrite step order: strength -> strength
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `5a7e5e402776ed44`
- Rewrite digest: `c7b93543e1ee43f4`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 1       |

### locked_attack_strength_training / reference-context

A current-level Attack target locks Attack while Strength advances.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: strength -> strength
- Rewrite step order: strength -> strength
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `5a7e5e402776ed44`
- Rewrite digest: `4c0747cfc3f0df3b`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 3       |

### magic_defence_spell_ladder / current-product

Magic and Defence ordering includes a bounded elemental spell ladder.

- Result: different
- Classification: source-data-delta
- Reason: The training order and bounded numeric or configuration differences remain unchanged. The source-backed Revision 274 incoming-attack profile adds the expected D-081 partial-model warning to this current-product magic comparison.
- Source: docs/project/decisions.md D-059/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/technical/architecture.md
- Difference count: 23
- Legacy step order: magic -> magic -> defence -> defence
- Rewrite step order: magic -> magic -> defence -> defence
- Rewrite warning codes: `incoming-attack-partial-model`, `price-fallback-used`
- Legacy digest: `5c31fab2dfe6c4be`
- Rewrite digest: `65e0c00cd0e871ae`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.807265     | 1.634344     |
| `$.end.metricValue`       | number | 31697.742885 | 31009.154181 |
| `$.phases[0].endDps`      | number | 1.807265     | 1.634344     |
| `$.phases[0].endMetric`   | number | 31697.742885 | 31009.154181 |
| `$.phases[0].startDps`    | number | 1.198869     | 1.078228     |
| `$.phases[0].startMetric` | number | 19567.797265 | 18924.229419 |
| `$.phases[1].endDps`      | number | 1.807265     | 1.634344     |
| `$.phases[1].endMetric`   | number | 31697.742885 | 31009.154181 |
| `$.phases[1].startDps`    | number | 1.807265     | 1.634344     |
| `$.phases[1].startMetric` | number | 31697.742885 | 31009.154181 |
| `$.start.dps`             | number | 1.198869     | 1.078228     |
| `$.start.metricValue`     | number | 19567.797265 | 18924.229419 |

Only the first 12 of 23 bounded differences are shown.

### magic_defence_spell_ladder / reference-context

Magic and Defence ordering includes a bounded elemental spell ladder.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: magic -> magic -> defence -> defence
- Rewrite step order: magic -> magic -> defence -> defence
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `price-fallback-used`
- Legacy digest: `5c31fab2dfe6c4be`
- Rewrite digest: `7e858d568a66f548`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 2       |

### magic_fire_bolt_unlock / current-product

Magic training unlocks fire bolt from the staff spell ladder.

- Result: different
- Classification: source-data-delta
- Reason: The training order and bounded numeric or configuration differences remain unchanged. The source-backed Revision 274 incoming-attack profile adds the expected D-081 partial-model warning to this current-product magic comparison.
- Source: docs/project/decisions.md D-059/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/technical/architecture.md
- Difference count: 14
- Legacy step order: magic -> magic
- Rewrite step order: magic -> magic
- Rewrite warning codes: `incoming-attack-partial-model`, `price-fallback-used`
- Legacy digest: `d9bb8abc7b78d52d`
- Rewrite digest: `ae028ad7a4866881`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.807265     | 1.634344     |
| `$.end.metricValue`       | number | 30068.018003 | 29515.959818 |
| `$.phases[0].endDps`      | number | 1.807265     | 1.634344     |
| `$.phases[0].endMetric`   | number | 30068.018003 | 29515.959818 |
| `$.phases[0].startDps`    | number | 1.198869     | 1.078228     |
| `$.phases[0].startMetric` | number | 18388.472533 | 17852.984783 |
| `$.start.dps`             | number | 1.198869     | 1.078228     |
| `$.start.metricValue`     | number | 18388.472533 | 17852.984783 |
| `$.steps[0].dps`          | number | 1.802886     | 1.626036     |
| `$.steps[0].metricValue`  | number | 30054.21499  | 29489.070559 |
| `$.steps[1].dps`          | number | 1.807265     | 1.634344     |
| `$.steps[1].metricValue`  | number | 30068.018003 | 29515.959818 |

Only the first 12 of 14 bounded differences are shown.

### magic_fire_bolt_unlock / reference-context

Magic training unlocks fire bolt from the staff spell ladder.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 2
- Legacy step order: magic -> magic
- Rewrite step order: magic -> magic
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `price-fallback-used`
- Legacy digest: `d9bb8abc7b78d52d`
- Rewrite digest: `6d293acab5316523`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.transitions`  | length | 0      | 1       |
| `$.warningCodes` | length | 0      | 2       |

### magic_negative_gph / current-product

GP/hour planning remains finite when rune costs outweigh loot value.

- Result: different
- Classification: source-data-delta
- Reason: The training order and bounded difference set remain unchanged. The current-product metric values and digests reflect the committed scheduled price snapshot layered on the Revision 274 game context.
- Source: prices.json; price-provenance.json; price-history.json; docs/technical/architecture.md; docs/project/decisions.md D-059/D-060
- Difference count: 17
- Legacy step order: magic -> magic
- Rewrite step order: magic -> magic
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `9dbd0105c727379a`
- Rewrite digest: `a7e6bf4bb45d8a3c`

| Path                        | Kind   | Legacy         | Rewrite       |
| --------------------------- | ------ | -------------- | ------------- |
| `$.end.config.spellId`      | value  | fire_bolt      | fire_strike   |
| `$.end.dps`                 | number | 1.829934       | 1.219956      |
| `$.end.metricValue`         | number | -164731.276636 | -46781.521196 |
| `$.phases[0].endDps`        | number | 1.829934       | 1.219956      |
| `$.phases[0].endMetric`     | number | -164731.276636 | -46781.521196 |
| `$.phases[0].startDps`      | number | 1.822994       | 1.215329      |
| `$.phases[0].startMetric`   | number | -165079.604202 | -47012.881161 |
| `$.start.config.spellId`    | value  | fire_bolt      | fire_strike   |
| `$.start.dps`               | number | 1.822994       | 1.215329      |
| `$.start.metricValue`       | number | -165079.604202 | -47012.881161 |
| `$.steps[0].config.spellId` | value  | fire_bolt      | fire_strike   |
| `$.steps[0].dps`            | number | 1.826533       | 1.217689      |

Only the first 12 of 17 bounded differences are shown.

### magic_negative_gph / reference-context

GP/hour planning remains finite when rune costs outweigh loot value.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 17
- Legacy step order: magic -> magic
- Rewrite step order: magic -> magic
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `price-fallback-used`
- Legacy digest: `9dbd0105c727379a`
- Rewrite digest: `0a92dc98de544ee2`

| Path                        | Kind   | Legacy         | Rewrite       |
| --------------------------- | ------ | -------------- | ------------- |
| `$.end.config.spellId`      | value  | fire_bolt      | fire_strike   |
| `$.end.dps`                 | number | 1.829934       | 1.219956      |
| `$.end.metricValue`         | number | -164731.276636 | -35056.390069 |
| `$.phases[0].endDps`        | number | 1.829934       | 1.219956      |
| `$.phases[0].endMetric`     | number | -164731.276636 | -35056.390069 |
| `$.phases[0].startDps`      | number | 1.822994       | 1.215329      |
| `$.phases[0].startMetric`   | number | -165079.604202 | -35265.759927 |
| `$.start.config.spellId`    | value  | fire_bolt      | fire_strike   |
| `$.start.dps`               | number | 1.822994       | 1.215329      |
| `$.start.metricValue`       | number | -165079.604202 | -35265.759927 |
| `$.steps[0].config.spellId` | value  | fire_bolt      | fire_strike   |
| `$.steps[0].dps`            | number | 1.826533       | 1.217689      |

Only the first 12 of 17 bounded differences are shown.

### max_levels_truncation / current-product

A deliberately short maxLevels bound reports truncation.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 17
- Legacy step order: strength -> attack
- Rewrite step order: strength -> attack
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `7c4a0b3ce4cdae44`
- Rewrite digest: `b02a3cf4bb137837`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.570956     | 1.646153     |
| `$.end.metricValue`       | number | 19112.035438 | 19936.406191 |
| `$.phases[0].endDps`      | number | 1.560284     | 1.637047     |
| `$.phases[0].endMetric`   | number | 18994.432548 | 19836.973793 |
| `$.phases[0].startDps`    | number | 1.404255     | 1.473342     |
| `$.phases[0].startMetric` | number | 17363.434686 | 18140.816534 |
| `$.phases[1].endDps`      | number | 1.570956     | 1.646153     |
| `$.phases[1].endMetric`   | number | 19112.035438 | 19936.406191 |
| `$.phases[1].startDps`    | number | 1.560284     | 1.637047     |
| `$.phases[1].startMetric` | number | 18994.432548 | 19836.973793 |
| `$.start.dps`             | number | 1.404255     | 1.473342     |
| `$.start.metricValue`     | number | 17363.434686 | 18140.816534 |

Only the first 12 of 17 bounded differences are shown.

### max_levels_truncation / reference-context

A deliberately short maxLevels bound reports truncation.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 17
- Legacy step order: strength -> attack
- Rewrite step order: strength -> attack
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `7c4a0b3ce4cdae44`
- Rewrite digest: `6804c05e3014413a`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.570956     | 1.646153     |
| `$.end.metricValue`       | number | 19112.035438 | 19936.406191 |
| `$.phases[0].endDps`      | number | 1.560284     | 1.637047     |
| `$.phases[0].endMetric`   | number | 18994.432548 | 19836.973793 |
| `$.phases[0].startDps`    | number | 1.404255     | 1.473342     |
| `$.phases[0].startMetric` | number | 17363.434686 | 18140.816534 |
| `$.phases[1].endDps`      | number | 1.570956     | 1.646153     |
| `$.phases[1].endMetric`   | number | 19112.035438 | 19936.406191 |
| `$.phases[1].startDps`    | number | 1.560284     | 1.637047     |
| `$.phases[1].startMetric` | number | 18994.432548 | 19836.973793 |
| `$.start.dps`             | number | 1.404255     | 1.473342     |
| `$.start.metricValue`     | number | 17363.434686 | 18140.816534 |

Only the first 12 of 17 bounded differences are shown.

### melee_attack_strength_greedy_order / current-product

Compare Attack and Strength ordering across a nearby max-hit boundary.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 18
- Legacy step order: attack -> attack -> strength -> strength
- Rewrite step order: attack -> attack -> strength -> strength
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `cfc4a0ff0eb9eb50`
- Rewrite digest: `bbde364cfba5a9ef`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.41386      | 1.481538     |
| `$.end.metricValue`       | number | 17471.90556  | 18232.599809 |
| `$.phases[0].endDps`      | number | 1.41386      | 1.481538     |
| `$.phases[0].endMetric`   | number | 17471.90556  | 18232.599809 |
| `$.phases[1].endDps`      | number | 1.41386      | 1.481538     |
| `$.phases[1].endMetric`   | number | 17471.90556  | 18232.599809 |
| `$.phases[1].startDps`    | number | 1.41386      | 1.481538     |
| `$.phases[1].startMetric` | number | 17471.90556  | 18232.599809 |
| `$.steps[0].dps`          | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue`  | number | 17363.434686 | 18140.816534 |
| `$.steps[1].dps`          | number | 1.41386      | 1.481538     |
| `$.steps[1].metricValue`  | number | 17471.90556  | 18232.599809 |

Only the first 12 of 18 bounded differences are shown.

### melee_attack_strength_greedy_order / reference-context

Compare Attack and Strength ordering across a nearby max-hit boundary.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 18
- Legacy step order: attack -> attack -> strength -> strength
- Rewrite step order: attack -> attack -> strength -> strength
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `cfc4a0ff0eb9eb50`
- Rewrite digest: `6bb0a472ae2a6728`

| Path                      | Kind   | Legacy       | Rewrite      |
| ------------------------- | ------ | ------------ | ------------ |
| `$.end.dps`               | number | 1.41386      | 1.481538     |
| `$.end.metricValue`       | number | 17471.90556  | 18232.599809 |
| `$.phases[0].endDps`      | number | 1.41386      | 1.481538     |
| `$.phases[0].endMetric`   | number | 17471.90556  | 18232.599809 |
| `$.phases[1].endDps`      | number | 1.41386      | 1.481538     |
| `$.phases[1].endMetric`   | number | 17471.90556  | 18232.599809 |
| `$.phases[1].startDps`    | number | 1.41386      | 1.481538     |
| `$.phases[1].startMetric` | number | 17471.90556  | 18232.599809 |
| `$.steps[0].dps`          | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue`  | number | 17363.434686 | 18140.816534 |
| `$.steps[1].dps`          | number | 1.41386      | 1.481538     |
| `$.steps[1].metricValue`  | number | 17471.90556  | 18232.599809 |

Only the first 12 of 18 bounded differences are shown.

### melee_balanced_metric / current-product

Balanced scoring maps rewrite balanced to legacy bal deterministically.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 22
- Legacy step order: attack -> strength -> strength -> attack
- Rewrite step order: attack -> strength -> strength -> attack
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `fb21b35eccc79ee5`
- Rewrite digest: `d17a216f947c50ff`

| Path                      | Kind   | Legacy   | Rewrite  |
| ------------------------- | ------ | -------- | -------- |
| `$.end.dps`               | number | 1.570956 | 1.646153 |
| `$.end.metricValue`       | number | 1.226922 | 1.279844 |
| `$.phases[0].endDps`      | number | 1.404255 | 1.473342 |
| `$.phases[0].endMetric`   | number | 1.114668 | 1.164573 |
| `$.phases[1].endDps`      | number | 1.560284 | 1.637047 |
| `$.phases[1].endMetric`   | number | 1.219372 | 1.27346  |
| `$.phases[1].startDps`    | number | 1.404255 | 1.473342 |
| `$.phases[1].startMetric` | number | 1.114668 | 1.164573 |
| `$.phases[2].endDps`      | number | 1.570956 | 1.646153 |
| `$.phases[2].endMetric`   | number | 1.226922 | 1.279844 |
| `$.phases[2].startDps`    | number | 1.560284 | 1.637047 |
| `$.phases[2].startMetric` | number | 1.219372 | 1.27346  |

Only the first 12 of 22 bounded differences are shown.

### melee_balanced_metric / reference-context

Balanced scoring maps rewrite balanced to legacy bal deterministically.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 22
- Legacy step order: attack -> strength -> strength -> attack
- Rewrite step order: attack -> strength -> strength -> attack
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `fb21b35eccc79ee5`
- Rewrite digest: `5c6d647fdb65994e`

| Path                      | Kind   | Legacy   | Rewrite  |
| ------------------------- | ------ | -------- | -------- |
| `$.end.dps`               | number | 1.570956 | 1.646153 |
| `$.end.metricValue`       | number | 1.226922 | 1.279844 |
| `$.phases[0].endDps`      | number | 1.404255 | 1.473342 |
| `$.phases[0].endMetric`   | number | 1.114668 | 1.164573 |
| `$.phases[1].endDps`      | number | 1.560284 | 1.637047 |
| `$.phases[1].endMetric`   | number | 1.219372 | 1.27346  |
| `$.phases[1].startDps`    | number | 1.404255 | 1.473342 |
| `$.phases[1].startMetric` | number | 1.114668 | 1.164573 |
| `$.phases[2].endDps`      | number | 1.570956 | 1.646153 |
| `$.phases[2].endMetric`   | number | 1.226922 | 1.279844 |
| `$.phases[2].startDps`    | number | 1.560284 | 1.637047 |
| `$.phases[2].startMetric` | number | 1.219372 | 1.27346  |

Only the first 12 of 22 bounded differences are shown.

### melee_defence_armour_unlock / current-product

Defence training unlocks rune armour from a bounded pool.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 17
- Legacy step order: defence -> defence
- Rewrite step order: defence -> defence
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `f5afd64c771172e9`
- Rewrite digest: `532095e749b186f1`

| Path                              | Kind  | Legacy            | Rewrite |
| --------------------------------- | ----- | ----------------- | ------- |
| `$.end.config.armour.body`        | value | rune_platebody    | none    |
| `$.end.config.armour.helm`        | value | rune_full_helm    | none    |
| `$.end.config.armour.legs`        | value | rune_platelegs    | none    |
| `$.end.config.armour.shield`      | value | rune_kite         | none    |
| `$.start.config.armour.body`      | value | adamant_platebody | none    |
| `$.start.config.armour.helm`      | value | adamant_full_helm | none    |
| `$.start.config.armour.legs`      | value | adamant_platelegs | none    |
| `$.start.config.armour.shield`    | value | adamant_kite      | none    |
| `$.steps[0].config.armour.body`   | value | rune_platebody    | none    |
| `$.steps[0].config.armour.helm`   | value | rune_full_helm    | none    |
| `$.steps[0].config.armour.legs`   | value | rune_platelegs    | none    |
| `$.steps[0].config.armour.shield` | value | rune_kite         | none    |

Only the first 12 of 17 bounded differences are shown.

### melee_defence_armour_unlock / reference-context

Defence training unlocks rune armour from a bounded pool.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 17
- Legacy step order: defence -> defence
- Rewrite step order: defence -> defence
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `f5afd64c771172e9`
- Rewrite digest: `0c2b876ec46d02bc`

| Path                              | Kind  | Legacy            | Rewrite |
| --------------------------------- | ----- | ----------------- | ------- |
| `$.end.config.armour.body`        | value | rune_platebody    | none    |
| `$.end.config.armour.helm`        | value | rune_full_helm    | none    |
| `$.end.config.armour.legs`        | value | rune_platelegs    | none    |
| `$.end.config.armour.shield`      | value | rune_kite         | none    |
| `$.start.config.armour.body`      | value | adamant_platebody | none    |
| `$.start.config.armour.helm`      | value | adamant_full_helm | none    |
| `$.start.config.armour.legs`      | value | adamant_platelegs | none    |
| `$.start.config.armour.shield`    | value | adamant_kite      | none    |
| `$.steps[0].config.armour.body`   | value | rune_platebody    | none    |
| `$.steps[0].config.armour.helm`   | value | rune_full_helm    | none    |
| `$.steps[0].config.armour.legs`   | value | rune_platelegs    | none    |
| `$.steps[0].config.armour.shield` | value | rune_kite         | none    |

Only the first 12 of 17 bounded differences are shown.

### melee_rune_scimitar_attack_unlock / current-product

Attack training unlocks rune scimitar through domain combat scoring.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 10
- Legacy step order: attack -> attack
- Rewrite step order: attack -> attack
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `f162237b680dcc13`
- Rewrite digest: `d1afe9e7a1d60842`

| Path                     | Kind   | Legacy       | Rewrite      |
| ------------------------ | ------ | ------------ | ------------ |
| `$.end.dps`              | number | 1.41386      | 1.481538     |
| `$.end.metricValue`      | number | 17471.90556  | 18232.599809 |
| `$.phases[0].endDps`     | number | 1.41386      | 1.481538     |
| `$.phases[0].endMetric`  | number | 17471.90556  | 18232.599809 |
| `$.steps[0].dps`         | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue` | number | 17363.434686 | 18140.816534 |
| `$.steps[1].dps`         | number | 1.41386      | 1.481538     |
| `$.steps[1].metricValue` | number | 17471.90556  | 18232.599809 |
| `$.transitions`          | length | 0            | 1            |
| `$.warningCodes`         | length | 0            | 1            |

### melee_rune_scimitar_attack_unlock / reference-context

Attack training unlocks rune scimitar through domain combat scoring.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 10
- Legacy step order: attack -> attack
- Rewrite step order: attack -> attack
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `f162237b680dcc13`
- Rewrite digest: `0a1965f099e58398`

| Path                     | Kind   | Legacy       | Rewrite      |
| ------------------------ | ------ | ------------ | ------------ |
| `$.end.dps`              | number | 1.41386      | 1.481538     |
| `$.end.metricValue`      | number | 17471.90556  | 18232.599809 |
| `$.phases[0].endDps`     | number | 1.41386      | 1.481538     |
| `$.phases[0].endMetric`  | number | 17471.90556  | 18232.599809 |
| `$.steps[0].dps`         | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue` | number | 17363.434686 | 18140.816534 |
| `$.steps[1].dps`         | number | 1.41386      | 1.481538     |
| `$.steps[1].metricValue` | number | 17471.90556  | 18232.599809 |
| `$.transitions`          | length | 0            | 1            |
| `$.warningCodes`         | length | 0            | 3            |

### no_work_target / current-product

A plan with targets at current levels returns no steps.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 3
- Legacy step order: none
- Rewrite step order: none
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `d26e97e207edd124`
- Rewrite digest: `6ae8bf52a235e2f2`

| Path                  | Kind   | Legacy       | Rewrite      |
| --------------------- | ------ | ------------ | ------------ |
| `$.start.dps`         | number | 1.404255     | 1.473342     |
| `$.start.metricValue` | number | 17363.434686 | 18140.816534 |
| `$.warningCodes`      | length | 0            | 1            |

### no_work_target / reference-context

A plan with targets at current levels returns no steps.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 3
- Legacy step order: none
- Rewrite step order: none
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `d26e97e207edd124`
- Rewrite digest: `0c5b5b2570ea0afe`

| Path                  | Kind   | Legacy       | Rewrite      |
| --------------------- | ------ | ------------ | ------------ |
| `$.start.dps`         | number | 1.404255     | 1.473342     |
| `$.start.metricValue` | number | 17363.434686 | 18140.816534 |
| `$.warningCodes`      | length | 0            | 3            |

### partial_current_attack_xp / current-product

Only the remaining XP in the current Attack level is charged.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 8
- Legacy step order: attack
- Rewrite step order: attack
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `1f0157962ebb9355`
- Rewrite digest: `277874b626ecd1fb`

| Path                     | Kind   | Legacy       | Rewrite      |
| ------------------------ | ------ | ------------ | ------------ |
| `$.end.dps`              | number | 1.404255     | 1.473342     |
| `$.end.metricValue`      | number | 17363.434686 | 18140.816534 |
| `$.phases[0].endDps`     | number | 1.404255     | 1.473342     |
| `$.phases[0].endMetric`  | number | 17363.434686 | 18140.816534 |
| `$.steps[0].dps`         | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue` | number | 17363.434686 | 18140.816534 |
| `$.transitions`          | length | 0            | 1            |
| `$.warningCodes`         | length | 0            | 1            |

### partial_current_attack_xp / reference-context

Only the remaining XP in the current Attack level is charged.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 8
- Legacy step order: attack
- Rewrite step order: attack
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `1f0157962ebb9355`
- Rewrite digest: `c67ed4a7cb6288ec`

| Path                     | Kind   | Legacy       | Rewrite      |
| ------------------------ | ------ | ------------ | ------------ |
| `$.end.dps`              | number | 1.404255     | 1.473342     |
| `$.end.metricValue`      | number | 17363.434686 | 18140.816534 |
| `$.phases[0].endDps`     | number | 1.404255     | 1.473342     |
| `$.phases[0].endMetric`  | number | 17363.434686 | 18140.816534 |
| `$.steps[0].dps`         | number | 1.404255     | 1.473342     |
| `$.steps[0].metricValue` | number | 17363.434686 | 18140.816534 |
| `$.transitions`          | length | 0            | 1            |
| `$.warningCodes`         | length | 0            | 3            |

### ranged_longrange_defence_training / current-product

Longrange planning compares Ranged and Defence stance-aware ordering.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: ranged -> ranged -> defence -> defence
- Rewrite step order: ranged -> ranged -> defence -> defence
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `c562f5c79f939807`
- Rewrite digest: `ee6fa41d110f21b4`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 1       |

### ranged_longrange_defence_training / reference-context

Longrange planning compares Ranged and Defence stance-aware ordering.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 1
- Legacy step order: ranged -> ranged -> defence -> defence
- Rewrite step order: ranged -> ranged -> defence -> defence
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `c562f5c79f939807`
- Rewrite digest: `27757b9f3d5d2ecb`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.warningCodes` | length | 0      | 3       |

### ranged_yew_shortbow_unlock / current-product

Ranged training unlocks yew shortbow without copying ranged formulas.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 2
- Legacy step order: ranged -> ranged
- Rewrite step order: ranged -> ranged
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `f6222f2613b97ea5`
- Rewrite digest: `5a3bba00a2f7d3f7`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.transitions`  | length | 0      | 1       |
| `$.warningCodes` | length | 0      | 1       |

### ranged_yew_shortbow_unlock / reference-context

Ranged training unlocks yew shortbow without copying ranged formulas.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 2
- Legacy step order: ranged -> ranged
- Rewrite step order: ranged -> ranged
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `f6222f2613b97ea5`
- Rewrite digest: `f07359e8a9fe4c47`

| Path             | Kind   | Legacy | Rewrite |
| ---------------- | ------ | ------ | ------- |
| `$.transitions`  | length | 0      | 1       |
| `$.warningCodes` | length | 0      | 3       |

### stable_weapon_transition / current-product

A longer Strength path exposes stable transition-run behavior.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Current-product now consumes D-071 source-backed requirement rows; the only baseline change is removal of manual-planner-requirement-fallback while previously reviewed training, numeric, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-071; docs/technical/source-backed-requirements-npc-size-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 25
- Legacy step order: strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength
- Rewrite step order: strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength
- Rewrite warning codes: `price-fallback-used`
- Legacy digest: `e9f8d0caf7e7a2df`
- Rewrite digest: `df8a1317645a10df`

| Path                         | Kind   | Legacy        | Rewrite          |
| ---------------------------- | ------ | ------------- | ---------------- |
| `$.end.config.weaponId`      | value  | rune_scimitar | dragon_longsword |
| `$.end.dps`                  | number | 2.555187      | 2.482182         |
| `$.end.metricValue`          | number | 2.555187      | 2.482182         |
| `$.phases[0].endDps`         | number | 2.555187      | 2.482182         |
| `$.phases[0].endMetric`      | number | 2.555187      | 2.482182         |
| `$.steps[3].config.weaponId` | value  | rune_scimitar | dragon_longsword |
| `$.steps[3].dps`             | number | 2.372674      | 2.336171         |
| `$.steps[3].metricValue`     | number | 2.372674      | 2.336171         |
| `$.steps[4].config.weaponId` | value  | rune_scimitar | dragon_longsword |
| `$.steps[4].dps`             | number | 2.372674      | 2.336171         |
| `$.steps[4].metricValue`     | number | 2.372674      | 2.336171         |
| `$.steps[5].config.weaponId` | value  | rune_scimitar | dragon_longsword |

Only the first 12 of 25 bounded differences are shown.

### stable_weapon_transition / reference-context

A longer Strength path exposes stable transition-run behavior.

- Result: different
- Classification: accepted-rewrite-delta
- Reason: Source-backed incoming damage added the expected D-081 compatibility-fallback warning to the legacy-derived reference context; training order, numeric output, configuration and transition deltas remain unchanged.
- Source: docs/project/decisions.md D-051/D-060/D-081; docs/technical/source-backed-incoming-damage-spec.md; docs/product/feature-inventory.md (Planner)
- Difference count: 25
- Legacy step order: strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength
- Rewrite step order: strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength -> strength
- Rewrite warning codes: `incoming-attack-compatibility-fallback`, `manual-planner-requirement-fallback`, `price-fallback-used`
- Legacy digest: `e9f8d0caf7e7a2df`
- Rewrite digest: `79c221f44393d945`

| Path                         | Kind   | Legacy        | Rewrite          |
| ---------------------------- | ------ | ------------- | ---------------- |
| `$.end.config.weaponId`      | value  | rune_scimitar | dragon_longsword |
| `$.end.dps`                  | number | 2.555187      | 2.482182         |
| `$.end.metricValue`          | number | 2.555187      | 2.482182         |
| `$.phases[0].endDps`         | number | 2.555187      | 2.482182         |
| `$.phases[0].endMetric`      | number | 2.555187      | 2.482182         |
| `$.steps[3].config.weaponId` | value  | rune_scimitar | dragon_longsword |
| `$.steps[3].dps`             | number | 2.372674      | 2.336171         |
| `$.steps[3].metricValue`     | number | 2.372674      | 2.336171         |
| `$.steps[4].config.weaponId` | value  | rune_scimitar | dragon_longsword |
| `$.steps[4].dps`             | number | 2.372674      | 2.336171         |
| `$.steps[4].metricValue`     | number | 2.372674      | 2.336171         |
| `$.steps[5].config.weaponId` | value  | rune_scimitar | dragon_longsword |

Only the first 12 of 25 bounded differences are shown.

## Boundaries

- No legacy Planner state was read or migrated.
- No future or hypothetical gear was executed.
- No live provider, network, auth, account, tenant or database path was used.
- No production module imports or executes `planner-core.js`.
- A `rewrite-gap` requires a separate accepted implementation decision.

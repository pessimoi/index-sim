# Legacy compatibility support matrix

- Status: active
- Date: 2026-07-31
- Owner: browser persistence and transfer compatibility
- Evidence: partial
- Contract: living

This matrix owns the current support lifecycle for historical browser state,
rewrite persistence upgrades, old transfer envelopes and calculation aliases.
It implements the inventory/freeze phase of the
[legacy compatibility sunset specification](legacy-compatibility-support-sunset-spec.md).

`retain-current` and `migrate-once` are current support promises.
`sunset-ready` requires the evidence named below; no entry has that disposition
while external tester state is unknown. `fixture-only`, `removed` and changes
to the accepted reader set require a reviewed implementation change.

## Freeze rule

- Do not add a legacy storage key, envelope version, URL version, file version
  or fallback alias without adding a row here.
- Name the real source version or consumer, reader owner, bounded validation,
  test owner and sunset rule.
- Current writers emit only current contextual formats. Retained legacy input
  must never be written back in its old format.
- Do not widen a schema to accept malformed historical input.
- Do not infer absent external data from a clean checkout or browser profile.

## Archived-browser storage

All keys below are read only by the migration review. Import keeps the old key;
explicit confirmed Clear removes only detected allowlisted keys. External
consumer state is `unknown` until the known tester completes the checkpoint.

| Identifier                       | Current reader / writer                               | Behavior and bound                                                                                          | Test owner                                                | Disposition      | Evidence before next disposition                                                                        |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `sim_input_v3`                   | `legacy-migration/setup-inspector`; no writer         | read/migrate/review/clear; 250,000 bytes; validated setup, custom setup, cannon and Duel subsets            | `legacy-migration-setup`, `legacy-migration-policy`       | `migrate-once`   | Current Workspace/setup backup, tester acknowledgement and one final Import/Keep/Clear handoff          |
| `sim_planner_v1`                 | `legacy-migration/price-review-inspectors`; no writer | read/review-only/clear; 250,000-byte detection bound; content not imported                                  | `legacy-migration-policy`, `legacy-migration-view-model`  | `retain-current` | Tester no-data/backup evidence plus explicit decision that review-only detection has no remaining value |
| `sim_loot_prefs_v1`              | `legacy-migration/preference-inspectors`; no writer   | read/migrate/review/clear; 100,000 bytes; allowlisted current loot-row mapping                              | `legacy-migration-preferences`, `legacy-migration-policy` | `migrate-once`   | Current Workspace backup and tester acknowledgement                                                     |
| `sim_hidden_tiers_v1`            | `legacy-migration/preference-inspectors`; no writer   | read/migrate/review/clear; 50,000 bytes; current tier schema                                                | `legacy-migration-preferences`, `legacy-migration-policy` | `migrate-once`   | Current Workspace backup and tester acknowledgement                                                     |
| `sim_compare_sort_v1`            | `legacy-migration/preference-inspectors`; no writer   | read/migrate/review/clear; 50,000 bytes; bounded sort-key mapping                                           | `legacy-migration-preferences`, `legacy-migration-policy` | `migrate-once`   | Tester acknowledgement after a current handoff                                                          |
| `sim_irrelevant_v1`              | `legacy-migration/preference-inspectors`; no writer   | read/migrate/review/clear; 50,000 bytes; ids validated against current monsters                             | `legacy-migration-preferences`, `legacy-migration-policy` | `migrate-once`   | Tester acknowledgement after a current handoff                                                          |
| `sim_loot_comp_open`             | key review only; no writer                            | detect/review/clear; no payload parsing; archived presentation state                                        | `legacy-migration-policy`                                 | `retain-current` | Tester no-data acknowledgement and proof no repository fixture needs production detection               |
| `sim_prices_v1`                  | `legacy-migration/price-review-inspectors`; no writer | read with matching alch map/migrate/review/clear; combined price bound 1,000,000 bytes; PriceSet validation | `legacy-migration-prices`, `legacy-migration-policy`      | `migrate-once`   | Current PriceSet/Workspace backup and tester round trip                                                 |
| `sim_alch_v1`                    | `legacy-migration/price-review-inspectors`; no writer | read with matching price map/migrate/review/clear; current generated high-alch wins after import            | `legacy-migration-prices`, `legacy-migration-policy`      | `migrate-once`   | Current PriceSet/Workspace backup and tester round trip                                                 |
| `sim_scraped_at_v1`              | `legacy-migration/price-review-inspectors`; no writer | bounded timestamp metadata for a valid imported PriceSet; review/clear                                      | `legacy-migration-prices`, `legacy-migration-policy`      | `migrate-once`   | Same evidence as the paired price import                                                                |
| `sim_scraped_keys_v1`            | key review only; no writer                            | detect/intentional-reset/clear; legacy scrape slugs are not imported                                        | `legacy-migration-policy`                                 | `retain-current` | Tester no-data acknowledgement and proof no migration fixture needs production detection                |
| `sim_price_history_v1`           | `legacy-migration/price-review-inspectors`; no writer | detect/review-only/clear; history content is not imported                                                   | `legacy-migration-policy`, `legacy-migration-view-model`  | `retain-current` | Tester backup/no-data evidence and explicit history-policy decision                                     |
| `sim_price_history_sanitized_v1` | key review only; no writer                            | detect/review-only/clear; content is not imported                                                           | `legacy-migration-policy`                                 | `retain-current` | Tester backup/no-data evidence                                                                          |
| `sim_price_history_sanitized_v2` | key review only; no writer                            | detect/review-only/clear; content is not imported                                                           | `legacy-migration-policy`                                 | `retain-current` | Tester backup/no-data evidence                                                                          |
| `sim_price_history_sanitized_v3` | key review only; no writer                            | detect/review-only/clear; content is not imported                                                           | `legacy-migration-policy`                                 | `retain-current` | Tester backup/no-data evidence                                                                          |
| `sim_price_history_sanitized_v4` | key review only; no writer                            | detect/review-only/clear; content is not imported                                                           | `legacy-migration-policy`                                 | `retain-current` | Tester backup/no-data evidence                                                                          |
| `sim_hiscore_player`             | `legacy-migration/preference-inspectors`; no writer   | read/migrate/review/clear; 200 bytes; bounded player-name validation                                        | `legacy-migration-preferences`, `legacy-migration-policy` | `migrate-once`   | Current Workspace backup or explicit tester no-data acknowledgement                                     |

## Rewrite persistence upgrades

| Identifier                                 | Reader / current writer               | Behavior and bound                                                                                 | Test owner                                         | External consumer          | Disposition    | Evidence before next disposition                                       |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------- | -------------- | ---------------------------------------------------------------------- |
| `index-sim:price-set:selected` envelope v1 | `selected-price-set`; writer emits v2 | read v1, normalize complete metadata, attempt transactional v2 save; 1,000,000-byte PriceSet bound | `market-ui-state`, `price-set-transfer-controller` | unknown old origin/profile | `migrate-once` | Workspace/PriceSet backup and tester confirmation no v1 origin remains |
| `index-sim:price-history` envelope v1      | `price-history`; writer emits v2      | read v1, add explicit legacy metadata/status, attempt v2 save; snapshot/item caps remain           | `market-ui-state`, `local-price-history-lifecycle` | unknown old origin/profile | `migrate-once` | Workspace backup and tester confirmation no v1 origin remains          |

Unknown versions of current keys remain attention/error states. They are not
silently reset and are not compatibility candidates without a new row.

## File and URL transfer compatibility

| Identifier                          | Reader / current writer                          | Behavior and bound                                                                                      | Test owner                                       | External consumer | Disposition      | Evidence before next disposition                                              |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------- | ---------------- | ----------------------------------------------------------------------------- |
| Saved setup `legacy-storage-v3`     | `setup-import`; writer emits contextual setup v1 | read/review current saved setup envelope v3; 250,000 bytes; duplicate-key, schema and entity validation | `setup-import`, `setup-file-transfer-controller` | unknown old files | `migrate-once`   | Inventory old files, export replacements and prove supported-field conversion |
| Saved setup contextual v1           | `setup-import`; current writer                   | read/write/review; 250,000 bytes; Revision context and entity validation                                | same as above                                    | current           | `retain-current` | not applicable while it is the current format                                 |
| Saved Duel collection legacy v1     | `duel-snapshots`; writer emits contextual v1     | read/review; 250,000 bytes; duplicate id, schema, cap and entity validation                             | `duel-file-transfer`, Duel controller tests      | unknown old files | `migrate-once`   | Inventory old files and complete a current contextual export round trip       |
| Saved Duel collection contextual v1 | `duel-snapshots`; current writer                 | read/write/review; 250,000 bytes; Revision context and entity validation                                | same as above                                    | current           | `retain-current` | not applicable while it is the current format                                 |
| Share URL v1                        | `shareable-setup`; writer emits v2               | read/review; 12,000 encoded characters and 8,192 JSON bytes; duplicate-key/schema/entity checks         | `shareable-setup`                                | unknown old links | `migrate-once`   | Inventory distributed links and provide a current v2 replacement              |
| Share URL v2                        | `shareable-setup`; current writer                | read/write/review with contextual data                                                                  | `shareable-setup`                                | current           | `retain-current` | not applicable while it is the current format                                 |
| Workspace v1 / area v1              | `workspace-backup`; current writer               | read/write/review/transactional restore; 10,000,000 bytes; per-area schema/version and rollback         | Workspace backup/restore suites                  | current           | `retain-current` | not applicable while it is the current backup format                          |

Unsupported files and links fail closed with sanitized copy. Existing URL
semantics are not changed in place.

## Calculation/data aliases

| Identifier                    | Reader / writer                               | Behavior                                                                  | Test owner                   | External consumer          | Disposition      | Evidence before next disposition                                                                   |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- | -------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `sapphire` → `uncut_sapphire` | `domain/economy/canonical-item-id`; no writer | exact current id wins; alias is fallback-only with provenance and warning | economy, Trip and data tests | unknown imported PriceSets | `retain-current` | Canonical id present in every accepted snapshot/PriceSet path and unchanged economy/golden results |
| `emerald` → `uncut_emerald`   | same                                          | same                                                                      | same                         | unknown imported PriceSets | `retain-current` | same                                                                                               |
| `ruby` → `uncut_ruby`         | same                                          | same                                                                      | same                         | unknown imported PriceSets | `retain-current` | same                                                                                               |
| `diamond` → `uncut_diamond`   | same                                          | same                                                                      | same                         | unknown imported PriceSets | `retain-current` | same                                                                                               |

## External-data checkpoint

- Status: `WAITING_EXTERNAL`
- Known tester backup/no-data acknowledgement: not received.
- Hosted origin or old browser profile: unknown.
- Distributed old share links/files: unknown.
- Safe backup path: current Workspace export plus current setup, Duel and
  PriceSet exports as applicable.
- Privacy boundary: record only format/origin existence and successful current
  round trip. Do not collect setup contents, player name, prices or history.

No reader or alias may move to `sunset-ready` until its row's external evidence
and affected local/browser tests are complete.

# Dynamic loot-table market dependency coverage specification

- Status: implemented
- Date: 2026-07-12
- Owner: `src/domain/trip`, `src/data/market-sync-items` and generated runtime readiness
- Product surface: tagged Loot valuation, market diagnostics and scheduled coverage planning
- Related decisions: D-052, D-058, D-072, D-084, D-085, D-086 and D-087

## Purpose

Keep the market dependency inventory for every active composite/tagged loot
valuation derived from the same Trip-domain tables that perform the numeric
calculation. Missing allowlist mappings must remain visible instead of being
silently omitted from market-sync expansion.

This specification does not itself approve new market source mappings or
change any loot formula. The separate high-impact allowlist expansion owns
which currently missing dependencies should be admitted to scheduled refresh.

## Verified previous gap

`src/domain/trip/index.ts` owns four active dynamic price paths:

- `herb`: identified and unidentified weighted herb tables;
- `gem`: jewel bands, the selected talisman and the nested mega-rare table;
- `casket`: the D-084 opened-content table; and
- `ultrarare`: fixed rows plus nested jewel and mega-rare values.

`src/data/market-sync-items.ts` previously duplicated only a subset of those
dependencies. It omitted ten species-specific unidentified herbs, four
gem/mega dependencies and the entire `ultrarare` dependency graph. An omitted
item was not even reported through `missingMappingItemIds`, so a current
monster expansion could look complete while the calculation still consumed a
static/generated fallback.

The generated Revision 274 runtime contains 41 active `herb` rows across 37
monsters, 38 `gem` rows, three `casket` rows and three `ultrarare` rows. Typed
eligible-only clue rows are inactive under D-072 and do not create market
dependencies until their player-state eligibility is modeled.

## Implemented contract

`DYNAMIC_LOOT_PRICE_DEPENDENCIES` is exported by the Trip domain and is built
from the exact calculation tables:

- identified herb keys and all eleven exact unidentified herb ids;
- canonical jewel-band keys, both possible talismans and all mega-rare keys;
- every non-coin D-084 casket component; and
- every fixed ultra-rare key plus the nested jewel/mega dependency union.

Only canonical/exact calculation keys enter this contract. Legacy aliases and
numeric fallback constants do not become market identities.

`MARKET_SYNC_TAG_ITEM_IDS` consumes this domain-owned contract directly.
Therefore a table-row change affects valuation and dependency expansion in the
same code change, and focused tests fail if the derived contract or active tag
coverage drifts.

## Audit and readiness behavior

`auditDynamicLootMarketDependencies(gameData)` reports, per tag:

- active drop count and affected monster ids;
- complete canonical dependency ids;
- ids with approved market mappings; and
- ids still missing an approved mapping.

It also reports any active non-eligible tag that has no dependency contract.
Generated runtime readiness publishes the aggregate counts. Missing mappings
are advisory coverage findings, not runtime blockers, because D-085 keeps
validated generated/static fallbacks usable.

Before the separate D-087 allowlist expansion, the audit reported:

| Tag         | Active rows | Dependencies | Missing mappings |
| ----------- | ----------: | -----------: | ---------------: |
| `casket`    |           3 |            7 |                0 |
| `gem`       |          38 |           12 |                4 |
| `herb`      |          41 |           22 |               10 |
| `ultrarare` |           3 |           26 |               12 |

Across overlapping tables there are 49 unique dependencies: 27 mapped and 22
missing. The missing set is:

- `adamant_javelin`, `dragon_med_helm`, `dragon_spear`, `dragonshield_a`,
  `rune_2h`, `rune_battleaxe`, `rune_javelin`, `rune_kiteshield`,
  `rune_spear`, `rune_sq_shield`, `runite_bar`, `silver_ore`; and
- the ten non-guam `unidentified_*` herb identities.

These are retained point-in-time findings from D-086. D-087 subsequently
admitted the twelve identified rows with item-page/parser evidence. Current
readiness is 39/49 mapped and ten missing; the remaining ids are exactly the
non-guam `unidentified_*` herb identities. See the implemented
[high-impact allowlist specification](high-impact-dynamic-loot-market-allowlist-spec.md).

## Calculation and warning behavior

No weights, quantities, denominators, fallback values, GP/kill, GP/hour or
inventory behavior change. Market expansion still returns only approved
mappings in `itemIds`; every dependency without a mapping is returned in
`missingMappingItemIds` and becomes a bounded market warning through the
existing server contract.

D-085 per-item provenance remains the source for used-value freshness and
fallback warnings. Dependency coverage explains why a value cannot yet be
scheduled; it does not duplicate or override item provenance.

## Acceptance evidence

- focused market-sync, server, Trip and generated-readiness tests pass 62/62;
- all four active dynamic tags have exact row counts and zero unrecognized
  active tags;
- casket dependencies still equal the D-084 component set;
- the pre-D-087 readiness snapshot reported 27/49 mapped and 22 missing without
  a blocker;
- refactoring the ultra-rare rows through the shared descriptor leaves all
  numeric tests and accepted golden outputs unchanged; and
- no allowlist entry, scheduled price or calculation baseline changes in this
  specification.

## Validation commands

```sh
npm run typecheck
npm run test -- src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/trip-loot-supply.test.ts src/tests/generated-runtime-adapter.test.ts
npm run runtime:readiness -- --example-limit 5
npm run test:golden
npm run lint
npm run format:check
git diff --check
```

## Open questions

- Will the market source later expose distinct supported pages for the ten
  non-guam unidentified herbs? D-087 keeps them out until source evidence and
  a parser dry-run exist.
- Should future inactive quest/clue rows gain dependency contracts when exact
  player-state eligibility becomes supported? They remain excluded today.
- Should composite values later expose one derived provenance summary in
  addition to their component rows? D-085 currently keeps components as truth.

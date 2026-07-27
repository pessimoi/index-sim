# Source-backed casket valuation specification

- Status: implemented
- Date: 2026-07-12
- Owner: `src/domain/trip` with pinned-source contract coverage
- Evidence: verified
- Contract: closed

- Product surface: Loot valuation and nested casket details
- Related decisions: D-055, D-058, D-059, D-062, D-072 and D-084

## Purpose

Replace the production runtime's generated object-cost valuation for ordinary
fishing caskets with the expected value of the exact Revision 274 open-casket
reward table.

This is a focused calculation-correctness change. It does not broaden the
market provider, introduce a generic dynamic-loot registry, change casket drop
rates or add an unopened-casket sell action.

## Implementation result

`src/domain/trip` now owns one exact 128-weight ordinary-casket reward table and
computes its opened-content EV from active exact-first component prices. The
generated `casket` object cost cannot override the marked composite value.
Missing exact/alias component prices use the matching generated source object
cost with a structured warning.

The selected Loot row exposes eight nested source bands, the computed parent
value and `Opened contents EV` wording. Parent `casket` history is intentionally
not presented as history for the component-derived value.

`scripts/lostcity-content-casket.ts` parses and asserts the pinned
`[opheld1,casket]` trigger through the bounded repository-local RuneScript
reader. Raw source generation fails when its roll denominator, branch
thresholds, reward identities or quantity expressions drift. The focused
fixture contract and the current `.sources/lostcity-content` dry run both pass.

## Pre-implementation state and verified problem

The generated Revision 274 snapshot retains ordinary casket drops as
`{ key: "casket", tag: "casket" }` for Dagannoth level 74, Dagannoth level 92
and Rock Crab. Each row has chance `1 / 128` and quantity `1`.

The generated item row for `casket` carries source object cost `50`. The root
runtime merges that value into the active `PriceSet` whenever no scheduled
market price exists.

`src/domain/trip.adjustDropPrices()` currently recalculates `gem`, `herb`,
`ultrarare` and `mega` tagged rows, but has no `casket` branch. Later,
`evaluateLoot()` prefers an exact `drop.key` price over `drop.price`. As a
result, merely adding a calculated `drop.price` is insufficient: the merged
`itemPrices.casket = 50` value would still override it.

The pre-implementation production result therefore treated an ordinary casket as worth `50 gp`
instead of the value of opening it. At the committed 2026-07-11 component
prices, the source formula evaluates to `3,360.9375 gp`. That example is audit
evidence, not a fixed expected value: component market prices must remain live.

The current legacy reference has a manually maintained `CASKET_TABLE` and
labels the row `Casket (opened)`. Its weights and coin assumption do not match
the pinned Revision 274 source, so legacy output is regression evidence rather
than the target formula.

## Accepted source evidence

The pinned source trigger
`scripts/skill_fishing/scripts/fishing_spots/memberfish.rs2#[opheld1,casket]`
deletes one casket, rolls `random(128)` and returns exactly one branch:

| Roll range | Weight | Reward                           |                                                Quantity |
| ---------- | -----: | -------------------------------- | ------------------------------------------------------: |
| `0..59`    |     60 | Coins                            | one equiprobable value from `20, 40, 80, 160, 320, 640` |
| `60..91`   |     32 | `uncut_sapphire`                 |                                                       1 |
| `92..107`  |     16 | `uncut_emerald`                  |                                                       1 |
| `108..115` |      8 | `uncut_ruby`                     |                                                       1 |
| `116..123` |      8 | `cosmic_talisman`                |                                                       1 |
| `124..125` |      2 | `uncut_diamond`                  |                                                       1 |
| `126`      |      1 | `keyhalf1`, canonical tooth half |                                                       1 |
| `127`      |      1 | `keyhalf2`, canonical loop half  |                                                       1 |

The coin branch has expected quantity:

```text
(20 + 40 + 80 + 160 + 320 + 640) / 6 = 210 gp
```

The parent expected value is:

```text
casketEv = (
  60 * 210
  + 32 * price(uncut_sapphire)
  + 16 * price(uncut_emerald)
  + 8 * price(uncut_ruby)
  + 8 * price(cosmic_talisman)
  + 2 * price(uncut_diamond)
  + 1 * price(tooth_half_key)
  + 1 * price(loop_half_key)
) / 128
```

The existing D-058 identity rule applies: `keyhalf1` resolves to
`tooth_half_key`, `keyhalf2` resolves to `loop_half_key`, and cut-gem aliases
must not replace the exact uncut identities while exact prices exist.

Repository-relative source references may appear in tests and provenance.
Absolute source paths and raw source bodies must not enter generated artifacts
or user-facing copy.

## Implemented behavior

### Valuation policy

For the existing `loot` action, `tag: "casket"` means **open and value the
contents**.

- The parent unit `price` and `saleValue` are the full-precision expected value
  of one opening.
- `evGp` remains `drop.chance * drop.qtyAvg * casketEv`.
- The calculation does not round the parent EV. Presentation may use the
  existing number formatter.
- Coin value is face value and does not depend on a market `coins` entry.
- Component prices are read at calculation time so scheduled or imported
  PriceSet changes flow through without rebuilding game data.
- `itemPrices.casket` must not override the opened-content EV. It remains
  reserved for a future explicit unopened-sale policy.
- `skip` remains zero. The specification adds no new loot action.

### Component price lookup

Each non-coin component uses the existing exact-first price lookup and warning
rules.

1. Exact canonical component price wins.
2. A reviewed existing alias may be used only when the exact key is missing.
3. If neither exists, use the generated/source object-cost fallback and emit a
   structured `price-fallback-used` warning naming the component.
4. Missing one component must not collapse the complete casket to `50 gp` or
   zero.

The implementation must not add a manually refreshed `_casket_avg` price or
persist the calculated parent EV into `prices.json`.

### Runtime ownership

`src/domain/trip` owns the pure casket expected-value calculation. Introduce a
single normalized table and helper, for example:

```ts
interface CasketRewardRow {
  name: string;
  itemId: EntityId | null;
  weight: number;
  quantity: number;
  fallbackUnitPrice: number;
}

interface CasketStats {
  ev: number;
  rows: Array<
    CasketRewardRow & {
      unitPrice: number;
      rowValue: number;
    }
  >;
}
```

The concrete internal type may differ, but the implementation must preserve:

- an explicit denominator of `128`;
- all source weights;
- the coin quantity expectation of `210`;
- exact canonical item identities; and
- enough row detail for UI expansion and deterministic tests.

Do not place the calculation in React, a view model, `market-source-mapping.ts`
or generated JSON by hand.

### Source drift guard

Until a later specification introduces a generic generated composite-loot
registry, add a focused source-contract test for the pinned Revision 274 casket
trigger.

The test must fail when the source branch thresholds, reward identities or
coin quantity expression change without a reviewed table update. It must use
the existing bounded repository-local source-reading policy and must not call a
live provider.

This focused guard is required because the current loot extractor preserves
only `tag: "casket"`; runtime readiness cannot infer or validate the child
table from that tag.

### Loot and inventory behavior

The casket remains one non-stackable parent pickup per successful drop for the
deterministic Trip inventory model.

- Nested reward rows are valuation/presentation detail, not simultaneous
  inventory pickups.
- Do not reserve one stack for every possible child reward.
- Do not change the current `slotFrac = 1` behavior.
- Do not add child reward healing, alching, burying or displacement behavior in
  this phase.
- Risk continues to sample the parent casket occurrence with deterministic
  expected contents. Sampling the exact child reward is later stochastic-model
  scope.

### UI presentation

The selected Loot row must make the policy understandable without requiring a
warning:

- display `Casket` with a visible detail such as `Opened contents EV`;
- show eight nested source bands with weight/chance, canonical item key,
  component price and EV share;
- show the coin band as `20-640 coins (210 average)` rather than pretending it
  is a fixed 210-coin source outcome;
- preserve exact tooth/loop labels;
- reuse the existing structured price-warning surface when a component falls
  back; and
- do not show the generated `50 gp` parent cost as the selected row price.

The nested rows must sum back to the parent EV within numeric tolerance.

The existing casket item price-history key does not represent a component-EV
history. This phase must not relabel it as such. A later per-item
provenance/freshness specification owns any derived composite history.

## Market boundary

The current market allowlist already contains the seven non-coin component
identities used by the casket table, and `MARKET_SYNC_TAG_ITEM_IDS.casket`
already expands them.

This specification therefore requires no new live provider, endpoint or
scheduled workflow. It requires regression coverage that the casket dependency
list remains exactly aligned with the source-backed valuation rows.

The ordinary `casket` market slug may exist, but it must not silently replace
opened-content valuation. Adding a user-selectable unopened-sale action would
require a separate product decision and persisted loot-action compatibility
review.

## Generated data and revision workflow

- Keep the generated top-level drop identity and source provenance unchanged.
- Do not hand-edit `src/data/generated/game-data.json` to insert a calculated
  market EV.
- A future revision bump that changes the casket trigger must fail the focused
  source-contract test and require a reviewed calculation impact.
- Runtime readiness may continue checking top-level tag/key coverage, but a
  focused composite-table check must own child-table completeness until the
  dynamic-table specification supersedes it.

## Testing requirements

### Domain tests

Add focused tests that prove:

- source weights sum to `128`;
- the coin branch average is exactly `210`;
- a synthetic PriceSet produces the formula's exact expected value;
- changing any one component price changes the parent EV by
  `weight / 128 * priceDelta`;
- exact component keys beat aliases;
- a missing component emits one bounded structured fallback warning;
- `itemPrices.casket = 50` does not override the calculated EV;
- parent `price`, `saleValue`, `evGp` and nested row totals agree; and
- the casket still consumes one expected non-stackable slot per successful
  parent drop.

### Generated-runtime integration tests

Using the committed production snapshot, verify all three active casket rows:

- retain `key: "casket"`, `tag: "casket"`, chance `1 / 128` and quantity `1`;
- resolve to the same active component-EV; and
- no longer resolve to the generated `50 gp` object cost.

The test must cover Dagannoth level 74, Dagannoth level 92 and Rock Crab by
stable monster id.

### View-model and browser tests

Verify:

- current parent price and GP/kill contribution;
- eight nested bands and their canonical keys;
- coin-average wording;
- component fallback warning surfacing; and
- no false `casket` market-history claim.

Browser coverage is required only if implementation changes visible markup or
copy. Baseline image updates are never automatic failure recovery.

### Calculation impact

Run the read-only numeric audit and classify the three affected monsters. The
expected direction is higher loot GP/kill under the opened-content policy.

Do not refresh archived legacy goldens to hide the delta. If a committed
current-product numeric baseline changes, record the source-backed casket
reason explicitly instead of using the generic `price-source` classification.

## Validation commands

The implementation handoff must run at least:

```sh
npm run typecheck
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/*-view-model.test.ts src/tests/data-generator.test.ts
npm run test:golden
npm run runtime:readiness -- --example-limit 5
npm run numeric:audit
npm run build
npm run lint
npm run format:check
git diff --check
```

Also run the relevant Playwright Loot test when presentation changes. Do not
write numeric, golden or visual baselines merely to make a failed check pass.

## Validation evidence

The 2026-07-12 implementation pass produced:

- 189/189 focused parser, generator, Trip and UI tests;
- 606/606 full Vitest tests and 19/19 unchanged legacy golden tests;
- a successful current `.sources/lostcity-content` raw-generator dry run with
  390 items and 63 monsters and no writes;
- generated runtime readiness `ready` with no blockers;
- 5,958/5,958 numeric cross-path comparisons with zero mismatches and three
  explicit `source-backed-casket` impact rows;
- one passing focused Chromium production-preview workflow;
- passing typecheck, production build, lint, Prettier and `git diff --check`;
  and
- no generated game-data, price or legacy-golden rewrite.

## Acceptance criteria

The specification is implemented only when:

- production caskets use the exact source-backed opened-content formula;
- the generated `50 gp` parent cost cannot override composite valuation;
- every component uses exact-first active prices with visible fallback;
- the nested presentation reconciles to the parent EV;
- deterministic Trip inventory behavior remains one parent slot;
- all three production monster rows are covered;
- pinned-source drift fails a focused test;
- numeric deltas are reviewed and explicitly classified; and
- no live-provider, persistence or generated-snapshot hand edit is introduced.

## Non-goals

- generic parsing/generation for every dynamic loot procedure;
- per-item price provenance or freshness metadata;
- expanding the scheduled market allowlist;
- selling an unopened casket;
- choosing between open and sell dynamically;
- exact stochastic sampling of casket child rewards;
- clue caskets, rusty quest caskets or other items that merely contain the word
  `casket`; and
- changing monster drop chances or quantities.

## Open questions and deferred boundaries

- Should a later product phase add a distinct `Sell unopened` action when a
  reliable `casket` market price exists?
- Should composite price history eventually derive a historical EV from child
  snapshots, or remain current-price-only?
- Should the later dynamic-table specification replace the focused source
  drift test with a generated shared-table contract?

None of these questions blocks the opened-content correction defined here.

# Per-item price provenance and freshness specification

- Status: implemented
- Date: 2026-07-12
- Owner: `src/domain/shared`, `src/data/schemas`, `src/adapters/market` and
  the scheduled market writer
- Product surface: active PriceSet status, Loot price detail and Economy
  history
- Related decisions: D-033, D-052, D-058, D-062, D-063, D-064 and D-085

## Purpose

Make every active item price explain where its numeric value came from, when
that value was actually observed or established and whether the latest
scheduled refresh replaced or retained it.

This specification closes a reliability gap in the current global snapshot
model. It does not change price formulas, add a market provider, widen the
market allowlist or make low-quality prices unavailable. Calculations continue
to consume numeric item prices; provenance and freshness become validated
parallel data used for audit, warnings and presentation.

## Current state and verified problem

`PriceSet` currently carries one top-level `source`, `createdAt` and optional
`provenance` beside the complete `itemPrices` record. It cannot describe
different origins inside that record.

The root runtime combines at least three distinct value classes into the same
map:

1. values committed in `prices.json` and eligible for scheduled market
   replacement;
2. older static values in `prices.json` that are outside the scheduled market
   mapping; and
3. missing values filled from generated Revision 274 item object costs by
   `src/adapters/generated/price-fallback.ts`.

The committed snapshot has 136 non-metadata price keys. The current scheduled
mapping contains 80 item ids: 77 are also present in `prices.json`, 59 committed
price keys are outside the mapping and three mapped ids (`bass`, `bolt` and
`bones`) have no committed price. These counts are point-in-time audit evidence,
not fixed acceptance values.

The scheduled writer already calculates useful transient item facts:

- updated or retained/skipped status;
- high, medium, low or retained quality;
- usable, accepted and rejected observation counts;
- latest usable trade time; and
- a retention reason.

Those facts exist only in the process report. The writer then copies the
complete current price map into `price-history.json` and sets one global
`_scraped_at` capture time. The browser converts that time into
`PriceSet.createdAt` and labels every shared history snapshot `Scheduled
market`.

Consequently:

- a retained old price appears to belong to the newest snapshot;
- a static value outside the mapping appears as scheduled market data;
- a generated object-cost fallback inherits the composed PriceSet's generated
  top-level provenance without an item-level explanation;
- local history capture time can be mistaken for price observation time; and
- runtime readiness checks numeric key availability without proving the origin
  or freshness of the value behind each key.

`_scraped_at` is valid as artifact capture time. It is not evidence that every
contained item price was observed at that time.

## Required semantic separation

The implementation must keep these concepts distinct:

| Concept              | Meaning                                                      | Must not mean                                |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| PriceSet `createdAt` | time the PriceSet artifact or user selection was created     | observation time for every item              |
| `valueOrigin`        | source that established the current numeric item value       | latest source that merely evaluated the item |
| `valueObservedAt`    | time of the accepted evidence that set the current value     | writer run time or local save time           |
| `evaluatedAt`        | latest scheduled attempt to refresh the item                 | proof that the retained value is current     |
| `refreshStatus`      | result of the latest applicable refresh attempt              | general source quality                       |
| `quality`            | confidence class for the evidence that established the value | freshness by itself                          |

An item can therefore be a market-observed value whose latest refresh was
retained. It can also be a legacy-static value that a scheduled run evaluated
but could not replace. Neither case may receive a new `valueObservedAt`.

## Target domain contract

Keep `PriceSet.itemPrices: Record<EntityId, number>` unchanged for calculation
compatibility. Add validated parallel metadata:

```ts
type ItemPriceValueOrigin =
  | "market-observation"
  | "legacy-static"
  | "generated-object-cost"
  | "imported"
  | "manual"
  | "unknown";

type ItemPriceRefreshStatus = "observed" | "retained" | "not-evaluated" | "not-applicable";

type ItemPriceQuality = "high" | "medium" | "low" | "fallback" | "unknown";

type ItemPriceReasonCode =
  | "insufficient-observations"
  | "outlier-filter-insufficient"
  | "latest-observation-too-old"
  | "source-item-unavailable"
  | "outside-market-allowlist"
  | "generated-price-fallback"
  | "legacy-metadata-unavailable"
  | "import-metadata-unavailable"
  | "manual-value";

interface ItemPriceMetadata {
  valueOrigin: ItemPriceValueOrigin;
  refreshStatus: ItemPriceRefreshStatus;
  quality: ItemPriceQuality;
  sourceId?: "markets.lostcity.rs";
  sourceSlug?: string;
  valueObservedAt?: string;
  evaluatedAt?: string;
  latestCandidateAt?: string;
  sourceObservations?: number;
  usableObservations?: number;
  acceptedObservations?: number;
  rejectedObservations?: number;
  reasonCode?: ItemPriceReasonCode;
}

interface PriceSet {
  // existing fields remain
  itemPrices: Record<EntityId, number>;
  itemPriceMetadata?: Record<EntityId, ItemPriceMetadata>;
}
```

The exact type names may differ, but all semantic fields and distinctions above
are required.

`itemPriceMetadata` is optional at the raw compatibility boundary so existing
fixtures and old imports can be migrated. Every active production PriceSet must
be normalized to one metadata row per `itemPrices` key before simulation.
Metadata without a corresponding numeric price is invalid.

High-alch values remain generated game data under D-063. This specification
does not add duplicate per-item high-alch metadata to `PriceSet`; their
provenance continues through `GameDataSnapshot.items[*]`.

## Metadata invariants

Schemas and normalization must enforce:

- timestamps are valid ISO timestamps when present;
- observation counts are bounded non-negative integers,
  `acceptedObservations <= usableObservations <= sourceObservations` and
  `acceptedObservations + rejectedObservations = sourceObservations`;
- `market-observation` requires the approved market source id and source slug;
- `observed` requires `market-observation`, `valueObservedAt` and
  `evaluatedAt`;
- `retained` requires `evaluatedAt` and an allowlisted reason code;
- `generated-object-cost` requires `quality = "fallback"`,
  `refreshStatus = "not-applicable"` and
  `reasonCode = "generated-price-fallback"`;
- `legacy-static`, `imported`, `manual` and `unknown` must not invent a market
  observation timestamp;
- metadata keys match normalized numeric price keys exactly in an active
  PriceSet; and
- raw upstream offer text, listing ids, usernames and free-form failure reasons
  are never stored.

The current writer's human-readable `reason` may remain in transient CLI
output. Committed and browser-persisted contracts use only bounded reason
codes.

## Scheduled current-price artifact

Keep `prices.json` as the compatibility numeric map, including `_scraped_at` as
the artifact capture time. Add a repository-owned sidecar named
`price-provenance.json`:

```ts
interface ScheduledPriceProvenanceArtifactV1 {
  version: 1;
  capturedAt: string;
  refreshSource: "markets.lostcity.rs";
  items: Record<EntityId, ItemPriceMetadata>;
}
```

The sidecar must contain exactly one row for every non-underscore key committed
in `prices.json`. It must not contain generated runtime-only fallback rows.
Those are composed from generated game data after the static files are loaded.
The top-level `refreshSource` names the writer's approved refresh provider; it
does not claim that every contained value originated from that provider.

The scheduled writer must construct and validate `prices.json`,
`price-provenance.json` and `price-history.json` in memory before writing any
candidate. The workflow's changed-file allowlist, parse checks, commit command
and tests must cover all three files. A failed run leaves the previous committed
set active.

This section originally identified the required change from the D-033/D-064
two-file output set. D-085 now accepts that change, and the implementation,
workflow and deployment gates use the three-file logical set.

## Writer update and retention rules

For an accepted new estimate:

- replace the numeric value in `prices.json`;
- set `valueOrigin = "market-observation"`;
- set `refreshStatus = "observed"`;
- set `valueObservedAt` to the newest accepted trade used by the estimate;
- set `evaluatedAt` to the writer capture time;
- persist high/medium/low quality and bounded observation counts; and
- clear any earlier retention reason.

For a retained estimate:

- keep the previous numeric value;
- preserve its previous `valueOrigin`, `valueObservedAt` and establishing
  quality;
- set `refreshStatus = "retained"` and `evaluatedAt` to the current run;
- store the current bounded counts, `latestCandidateAt` when available and one
  reason code; and
- never move `valueObservedAt` forward.

For a committed price outside the market allowlist:

- preserve the value;
- use `valueOrigin = "legacy-static"`;
- use `refreshStatus = "not-evaluated"`, `quality = "unknown"` and
  `reasonCode = "outside-market-allowlist"`; and
- leave market timestamps absent.

When the writer mapping contains an item with no previous numeric price and no
accepted estimate, no numeric price or sidecar item row is created. Generated
runtime composition may still supply an explicit generated fallback later.

The writer must reject an updated estimate whose accepted observation time is
later than the bounded future-skew policy or older than the existing D-062
acceptance window. Capture time alone may not substitute for a missing live
trade timestamp in production item-page reads. Fixture/dev direct-price input
may use capture time only when its non-live nature is explicit in the report
and tests.

## Initial migration of existing prices

The first sidecar generation must not infer historical truth from membership in
the current market allowlist or from `_scraped_at`.

- Existing numeric rows without reconstructable item-level evidence start as
  `legacy-static`, `unknown` quality and no `valueObservedAt`.
- Membership in the market mapping may set `sourceId`/`sourceSlug` only as the
  refresh target, not as the value origin.
- A subsequent successful estimate promotes only that item to
  `market-observation`.
- A subsequent retained attempt records evaluation status while preserving the
  legacy-static origin and absent observation time.

A reviewed migration may reconstruct individual observations from deterministic
repository history only if it proves the exact writer report and accepted trade
timestamp for each item. The default implementation must not perform this
backfill.

## Generated runtime fallback composition

`withGeneratedAlchAuthority(..., { fillMissingItemPrices: true })` currently
merges generated item object costs under active prices and then replaces the
PriceSet-level provenance with a generated summary.

The target composition must instead preserve item metadata:

- existing active numeric prices and metadata win by exact item id;
- every newly filled generated price receives
  `valueOrigin = "generated-object-cost"`,
  `refreshStatus = "not-applicable"`, `quality = "fallback"` and
  `reasonCode = "generated-price-fallback"`;
- generated item provenance supplies a bounded source reference and verified
  revision time when available, but never a market observation time; and
- the PriceSet-level provenance becomes an honest composition summary rather
  than the only origin signal.

Generated fallbacks remain runtime composition. They must not be written into
`prices.json`, `price-provenance.json` or shared market history.

## Price lookup and calculation behavior

Economy and Trip exact-first price lookup must return both the numeric result
and its normalized item metadata. Existing price aliases retain the metadata of
the numeric key that actually supplied the value.

No price multiplier, drop rate, expected value, GP/hour or GP/XP formula changes
because of metadata. Low, retained, legacy-static, generated and unknown prices
remain usable unless a separate future product decision changes calculation
policy.

Structured warnings are required only when a used value needs attention:

- `price-market-retained` for a selected/used value whose latest applicable
  refresh was retained;
- `price-freshness-unknown` for a selected/used legacy/imported/unknown value
  without an observation time; and
- `price-generated-fallback` for a selected/used generated object cost.

Warnings must be deduplicated by warning code plus supplying item id. Aggregate
surfaces show counts instead of emitting hundreds of repeated messages. Missing
price and alias warnings remain distinct existing conditions.

## Freshness presentation model

Derive display freshness without mutating stored provenance:

| Display state       | Rule                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| `observed-current`  | market origin, known observation age at most 30 days and latest refresh observed   |
| `retained`          | latest applicable refresh retained, regardless of the age of the established value |
| `observed-stale`    | market origin with observation age over 30 days                                    |
| `unknown`           | no trustworthy observation/establishment time                                      |
| `not-market-priced` | generated object cost or another explicit non-market value                         |

The current 30-day boundary follows D-062's latest accepted trade policy. A
future threshold change must update the estimator, display derivation and tests
together.

Quality is displayed separately from freshness. A low-quality observation can
be current; a previously high-quality value can later be retained or stale.

## Shared price history v2

The complete price map may remain in each retained history snapshot so current
as-of movers and baselines continue to work. Every snapshot must additionally
distinguish a new market observation from a carried-forward value.

Replace the unversioned root array with a versioned contract:

```ts
interface SharedPriceHistoryArtifactV2 {
  version: 2;
  snapshots: Array<{
    t: number;
    kind: "writer-evaluated" | "legacy-unknown";
    prices: Record<EntityId, number>;
    evaluations: Record<
      EntityId,
      | {
          result: "observed";
          valueObservedAt: string;
          quality: "high" | "medium" | "low";
        }
      | {
          result: "retained";
          reasonCode: ItemPriceReasonCode;
        }
    >;
  }>;
}
```

`evaluations` is sparse and contains only market-mapped items evaluated during
that writer run. `prices` remains the complete committed numeric as-of map. In
a `writer-evaluated` snapshot, items absent from `evaluations` are carried
forward/not evaluated, not newly observed. `legacy-unknown` marks a migrated
snapshot for which no item-level evaluation status is trustworthy.

The current 12-hour, 90-day and older daily compaction policy remains. Bucket
replacement and compaction must preserve the selected snapshot's matching
`evaluations` record.

The parser must accept the legacy v1 root array during migration. Every v1
point becomes a `legacy-unknown` snapshot; its `t` is a snapshot time, not an
item observation time. The next writer run emits only v2. Do not backfill v1
rows as observed from their timestamps.

Economy may continue plotting full as-of price lines and comparing complete
snapshots. Trend points must expose whether the item was observed, retained,
carried forward or legacy-unknown at that snapshot. UI wording must not call a
carried-forward or legacy-unknown point a fresh market observation.

## Browser-local history and selected PriceSet migration

`Save local comparison` captures an active PriceSet for later comparison. Its
save time is not a new price observation.

- Browser price-history storage moves to version 2 and stores capped metadata
  matching its capped item-price keys.
- Existing version 1 local snapshots migrate as `unknown` origin/freshness;
  their numeric values remain available.
- New local snapshots preserve the active PriceSet's item metadata and add a
  separate local `capturedAt`.
- Clearing local history remains unable to change shared history.

Selected PriceSet storage moves from version 1 to version 2 with an explicit v1
migration. A valid v1 PriceSet keeps every numeric price and receives
`imported`/`unknown` metadata unless stronger row-level evidence is actually
present. Version mismatch must not silently clear the old key.

External PriceSet import remains backwards compatible:

- old files without item metadata are accepted and normalized to
  `imported`/`unknown` rows;
- new exports include validated item metadata;
- metadata keys not backed by numeric values are rejected;
- malformed, oversized or duplicate-key files remain non-fatal sanitized
  errors; and
- import/export never upgrades capture time into observation time.

Legacy `sim_prices_v1` migration follows the same imported/unknown rule. D-049
continues to keep full legacy history payload migration outside V1.

## UI requirements

The Market/Economy status summary must show separate counts for:

- market-observed values by quality;
- retained latest refresh attempts;
- legacy/static or imported values with unknown freshness;
- generated object-cost fallbacks added at runtime; and
- missing prices.

For a selected Loot row, nested component or Economy item, show:

- the numeric price;
- the value origin label;
- observation time/age when known;
- latest refresh result and evaluation time when applicable;
- quality when applicable; and
- a compact bounded reason label for retained/fallback/unknown states.

Snapshot capture age remains visible separately. The UI must not use one green
`loaded` state to imply that every item is fresh.

The UI must not expose raw upstream payloads, source HTML, usernames, absolute
paths or unbounded error strings. Existing English UI language remains.

## Deployment and cache boundary

`price-provenance.json` becomes a required same-origin static asset beside
`prices.json` and `price-history.json`.

Implementation must update:

- Vite scheduled asset copying;
- Cloudflare deployment artifact verification and public smoke checks;
- static cache/header rules;
- scheduled loader file statuses and byte limits;
- browser/e2e route fixtures; and
- scheduled workflow changed-file/commit allowlists.

The current-price and provenance sidecar must use compatible cache semantics so
a client does not indefinitely combine different revisions. The loader must
verify matching capture times before accepting both as a scheduled PriceSet.
On mismatch or invalid/missing provenance, it may keep a previously validated
active PriceSet or use the explicit fallback, but it must not label the new
numeric file item-provenanced.

`price-provenance.json` uses the existing one-megabyte current-price class
limit unless measured output requires a reviewed smaller/larger bound. Shared
history keeps its existing five-megabyte limit. All parsers retain duplicate-key
checks and strict schemas.

## Runtime readiness and diagnostics

Extend readiness and data/economy diagnostics to report:

- active numeric item count and metadata coverage count;
- count by value origin, refresh status and quality;
- market mappings with missing numeric values;
- committed numeric/sidecar key mismatches;
- generated fallbacks used to complete the runtime; and
- dynamic/loot dependencies whose price origin is not market-observed.

Missing or invalid metadata for an active production numeric price is a
readiness blocker after migration. Retained, low-quality, legacy-static and
generated fallback rows are visible coverage findings but do not by themselves
make the runtime invalid.

The later dynamic-dependency and allowlist specifications own whether a visible
fallback should be replaced by broader market coverage. This specification
only makes the condition truthful.

## Implementation sequence

1. Add strict item metadata schemas, normalized lookup types and migration
   helpers without changing calculations.
2. Add `price-provenance.json`, writer persistence and atomic in-memory
   validation for the three scheduled artifacts.
3. Introduce history v2 plus legacy array parsing and shared-analysis status.
4. Compose generated fallback metadata and migrate selected/local PriceSet
   persistence and import/export.
5. Surface bounded status in Economy/Loot and extend readiness diagnostics.
6. Update deployment asset lists, headers, workflow allowlists, tests and
   accepted decisions.

Each phase must keep old files readable until the new scheduled artifact set is
committed and the root loader can validate it.

## Testing requirements

### Schema and normalization tests

Prove:

- every valid origin/status/quality combination;
- invalid timestamps, counts, reason codes and metadata-only keys fail;
- old PriceSets normalize without losing numeric values;
- no migration invents market observation timestamps; and
- duplicate-key and byte limits apply to the new sidecar/history contracts.

### Writer tests

Prove:

- an updated item records its accepted trade time and quality;
- a retained item preserves value origin, observation time and value quality;
- a retained legacy-static item does not become market-observed;
- an outside-allowlist price remains not evaluated;
- a mapped item with neither prior nor accepted value remains absent;
- all three artifacts validate before writes and deterministic reruns are
  stable; and
- v1 history migrates to v2 without treating snapshot timestamps as
  observations.

### Runtime and persistence tests

Prove:

- exact active prices keep their row metadata;
- generated-only prices receive explicit fallback metadata;
- PriceSet-level composition does not erase row origin;
- selected state v1, local history v1 and old file imports migrate safely;
- new save/export/readback preserves metadata; and
- alias lookup reports the supplying key's metadata.

### UI and history tests

Prove:

- snapshot capture time and item observation time render separately;
- observed, retained, stale, unknown and non-market states are distinguishable;
- shared trend points classify observed versus carried-forward values;
- movers still compare complete as-of maps;
- used-value warnings are deduplicated; and
- aggregate counts reconcile to the active PriceSet.

### Deployment tests

Prove the build and public artifact require the provenance sidecar, apply the
intended cache/header policy and reject capture-time or key-set mismatches.

## Validation commands

The implementation handoff must run at least:

```sh
npm run typecheck
npm run test -- src/tests/market-writer.test.ts src/tests/market-adapter.test.ts src/tests/data-economy.test.ts
npm run test -- src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts src/tests/trip-loot-supply.test.ts src/tests/ui-view-model.test.ts
npm run runtime:readiness -- --example-limit 5
npm run test:golden
npm run deploy:verify-artifact
npm run build
npm run lint
npm run format:check
git diff --check
```

Run the relevant Economy/Loot Playwright smoke when visible status or detail
markup changes. Do not refresh numeric, golden or visual baselines merely to
hide a provenance/freshness regression.

## Acceptance criteria

The specification is implemented only when:

- every active production item price has validated row metadata;
- writer capture time, item observation time and refresh evaluation time are
  distinct;
- retaining a value cannot make it appear newly observed;
- existing unknown history is not silently backdated or upgraded;
- generated object costs are visibly classified as fallbacks;
- calculations keep the same numeric price behavior;
- shared and local history preserve truthful point status;
- old PriceSet and browser-storage formats migrate without losing prices;
- the three scheduled artifacts and deployment copies validate as one logical
  set;
- readiness reports origin/freshness coverage; and
- D-033/D-064 and owning documentation reflect the accepted artifact change.

## Implementation outcome

Implemented on 2026-07-12 under D-085:

- `PriceSet.itemPriceMetadata` now carries strict per-item origin, refresh,
  quality, bounded counts, reason codes and distinct observation/evaluation
  timestamps while numeric price lookup remains unchanged.
- `price-provenance.json` v1 covers every committed numeric price key, and the
  scheduled writer validates prices, provenance and shared history before
  deterministic three-file writes.
- `price-history.json` is version 2. Legacy root arrays parse as
  `legacy-unknown`; new writer points retain sparse observed/retained
  evaluations through bucket replacement and compaction.
- generated object costs remain runtime-only and receive explicit fallback
  metadata. The runtime readiness report blocks missing metadata coverage and
  reports origin, refresh and quality counts.
- selected PriceSet and browser-local history storage use version 2 with
  explicit v1 migrations. Old PriceSet files remain accepted as
  imported/unknown without invented observation timestamps.
- Economy shows aggregate item metadata counts and selected-item provenance,
  freshness, quality and bounded reason detail. Shared trend points distinguish
  observed, retained, carried-forward, migrated legacy and local captures.
- Trip/Economy warnings are emitted only for used retained, unknown-freshness
  or generated-fallback values and deduplicate by code plus supplying item id.
- Vite assets, Cloudflare headers, artifact/public deployment checks and the
  scheduled workflow now require the provenance sidecar with matching capture
  time and numeric key set.

## Non-goals

- expanding `MARKET_SOURCE_MAPPINGS`;
- completing dynamic loot-table dependency coverage;
- changing the market estimator or accepted observation thresholds except for
  timestamp truthfulness;
- refusing calculation solely because a price is retained, low quality,
  static, imported or generated;
- adding a database, user account or browser-triggered refresh;
- storing raw upstream pages, listings or user identities;
- generating historical composite casket values; and
- changing high-alch authority.

## Open questions and deferred boundaries

- Should a future UI let users filter calculations by a minimum freshness or
  quality policy? The default here remains informative, not blocking.
- Is reviewed item-level history reconstruction from old repository commits
  worth doing? The safe default is no backfill.
- Should long-term history later store sparse price deltas instead of complete
  as-of maps? This specification retains complete maps for current mover
  behavior.
- Should derived composite values such as opened caskets receive separately
  calculated provenance/history? Their component rows remain the truth in this
  phase.

None of these questions blocks truthful per-item metadata and freshness.

The implemented D-090 local correction workflow is specified in
[manual-item-price-overrides-spec.md](manual-item-price-overrides-spec.md). It
uses the already-valid `manual` origin and `manual-value` reason without
changing scheduled observation semantics.

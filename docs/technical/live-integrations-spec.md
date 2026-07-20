# Live integrations specification

- Status: repository implementation retained; automatic market workflow disabled
- Date: 2026-07-15
- Owner: technical docs
- Related decisions: [D-015](../project/decisions.md), [D-021](../project/decisions.md), [D-033](../project/decisions.md), [D-061](../project/decisions.md), [D-062](../project/decisions.md), [D-065](../project/decisions.md), [D-066](../project/decisions.md), [D-099](../project/decisions.md)
- Legacy evidence: `views.jsx` `HiscoresLookup`, `views.jsx` `SettingsPane`, `market.js`

## Execution specifications

This document owns the product and API contracts. The remaining implementation and operations phases are split into:

- [hiscores-live-implementation-spec.md](hiscores-live-implementation-spec.md): authoritative provider, D-066 Cloudflare runtime, privacy and adopter deployed-evidence runbook for Hiscores.
- [hiscores-global-rate-limit-spec.md](hiscores-global-rate-limit-spec.md): implemented disabled strict provider-wide budget plus conditional activation and location-scoped abuse-control boundary.
- [../operations/market-live-evidence-spec.md](../operations/market-live-evidence-spec.md): retained writer hardening, explicit cron re-enablement and scheduled-current evidence for market prices.
- [../operations/public-deployment-spec.md](../operations/public-deployment-spec.md): Cloudflare public hosting, release and rollback work.

## Purpose

Hiscores lookup and committed market-price refresh are accepted product
features, not local-dev-only helpers or removal candidates. The current repo
does not contain the legacy `run_sim.py` backend. This specification preserves
the implemented product and integration contracts; the current runtime shape
is owned by [architecture.md](architecture.md), and adopter-operated live
evidence is owned by the execution specifications above.

The implementation must preserve the useful legacy workflows while replacing the fragile parts:

- stale `python run_sim.py` UI instructions
- browser-global `window.*` price mutation
- ad hoc `/api/prices`, `/api/scrape` and `/api/hiscores` calls with no repo-owned server source
- direct browser scraping where CORS and upstream HTML changes can break behavior
- unvalidated market keys and localStorage-driven reproducibility drift

## Product scope

### Hiscores lookup

Users can enter a player name, fetch combat-relevant stats from an approved hiscores source and apply the returned levels to the simulator setup.

Product decision: hiscores is required for v1 replacement. D-061 accepts the first-party 2004Scape JSON API, D-065 accepts no player-name/query persistence and D-066 selects one root-path Cloudflare Worker + Static Assets deployment with enabled Hiscores and disabled Workers Logs/Logpush. D-067 closes repository implementation and leaves account connection plus deployed verification to a future operator before a public-live claim.

Accepted source evidence:

- The first-party [Hiscores API announcement](https://2004.lostcity.rs/news/199) documents `GET /api/hiscores/player/:username`, skill type ids 1-7, stored XP units and upstream rate limits.
- `src/server/lostcity-hiscores-provider.ts` maps that JSON contract through a fixed HTTPS origin, redirect rejection, bounded response reading and sanitized provider errors.
- Direct browser fetch remains outside the architecture. The UI and domain depend on the repo-owned same-origin adapter contract, not the upstream URL.

MVP behavior:

- visible in the rewrite UI wherever level editing lives
- fetches Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic
- previews fetched levels before applying or clearly reports what changed
- applies only returned skills; missing skills do not reset existing levels
- stores the last searched player name locally only when browser storage is available
- provides understandable empty, not-found, rate-limited and service-unavailable states

Current implementation note: the rewrite header exposes player input, service status, lookup and a bounded preview/Apply overlay for these seven skills. It calls the same-origin hiscores API through `src/adapters/hiscores`, stores the last searched player with the rewrite `PersistedEnvelope<T>` helper only after a fresh response still matches the normalized current Player input and never calls a live upstream directly from the browser. Changing the Player input to a different normalized name clears the preview, late responses for old inputs are ignored and Apply rechecks freshness before mutating levels. A changed batch captures the exact preceding form and exposes the app's one-step global Undo; stale and zero-change attempts mutate nothing and preserve an earlier useful Undo. The preview shows the returned player, source and fetchedAt metadata and derives its Current values from the form across Apply and Undo. Vite dev/preview injects the D-061 source-backed provider into the repo-owned middleware; upstream failures remain sanitized and manual Player level fields stay usable. D-066 supplies the accepted same-origin production runtime through the root-path Cloudflare Worker + Static Assets adapter. A concrete public-live claim still requires the adopter's deployed routing and privacy evidence.

### Market price refresh

Users run simulations with an explicit committed, imported or manually adjusted PriceSet. High alch is Revision 274 game data, not a market value. D-099 disables automatic upstream refresh because the current maintainer has no GitHub Actions capacity.

Accepted target source: `markets.lostcity.rs`.

Accepted writer and storage model:

- The repo-owned writer is the only accepted shared upstream writer implementation, but D-099 currently permits no automatic execution.
- No user-triggered, manually-triggered or browser-triggered upstream refresh is accepted for production.
- No database is used for market prices or shared price history.
- Latest item prices live in `prices.json`.
- Generated `GameDataSnapshot.items[*].alch` values are authoritative; `alch.json` is compatibility/regression evidence and is not a scheduled-writer output.
- Shared price snapshots live in `price-history.json`: 12-hour points are retained for 90 days and older history is compacted to one latest point per UTC day.
- The scheduled writer validates generated JSON, runs the relevant data/economy checks and commits only when the generated files differ.
- The retained disabled template schedules GitHub Actions cron twice daily at 00:15 and 12:15 UTC if explicitly restored.
- If restored, the workflow uses the repository `GITHUB_TOKEN` with `contents: write` and commits directly to the same branch/repo only when the JSON files differ.
- The workflow must not expose `workflow_dispatch`; manual upstream refresh is not part of the accepted production model.
- The workflow should not upload artifacts or use large caches unless a future evidence-backed need appears.

Browser-local accepted-price history remains separate UI state for a user's selected imported or active PriceSet. Economy merges it in memory with read-only shared `price-history.json`; neither source is copied into the other.

MVP behavior:

- keeps existing file import as an offline fallback
- loads the latest scheduled static price files into an explicit `PriceSet`
- shows source, fetched time, item/alch counts and compact warnings
- preserves missing-price warnings instead of silently mutating fallback data
- updates browser-local comparison history only after a validated price set is accepted by the UI or captured with `Save local comparison`

Current implementation note: the visible Market/Economy path has no upstream refresh control and states that automatic refresh is disabled. The browser reads same-origin committed `prices.json` plus optional `price-history.json`; generated game data supplies the complete high-alch map, so runtime validity no longer depends on `alch.json`. A valid persisted selected PriceSet wins over the committed snapshot, and that snapshot wins over the bundled fallback. Every restored, imported or compatible legacy PriceSet keeps its item prices but receives current generated high-alch values before use, persistence or export. Import failures remain sanitized and non-fatal. Economy analyzes validated shared history together with separate local comparisons, labels their counts, and keeps shared rows read-only. `Save local comparison`, `Clear local history` and local-override reset touch only their allowlisted browser keys. The same-origin market status/sync API remains compatibility scaffolding with mocked tests; production copy does not imply that users can start an upstream refresh.

## Non-goals for the first implementation

- user accounts or authentication
- database-backed saves
- public third-party API guarantees
- arbitrary URL scraping
- browser-side scraping of upstream HTML
- user-triggered upstream market refresh
- server-managed shared price history outside the accepted static JSON files
- changing simulation math while adding the integrations

The accepted market writer target remains static JSON, but D-099 disables its automatic repository schedule. Interactive market upstream refresh is not a production target; the existing mocked/current sync paths remain compatibility scaffolding.

## Live Integration Gap Buckets

Status date: 2026-07-11. This table separates repository implementation from
adopter environment evidence for the current `Market price sync` and `Hiscores`
feature inventory rows. Both are `Valmis` at the D-067 repository-handoff
boundary. The accepted Hiscores provider is wired to Vite dev/preview and the
D-066 Cloudflare production Worker; deployed evidence remains a concrete
instance claim gate. D-061/D-066 resolve the source and runtime boundaries
without claiming that anyone currently operates a public instance.
[D-044](../project/decisions.md) keeps archived legacy `run_sim.py` and
legacy `/api/*` shims archive-only for the current rewrite path.

Current open `release-required` gap count for the visible rewrite release
boundary: 0. The open production-live gaps below must stay out of release copy
unless their dependency is accepted and implemented.

| Feature row       | Accepted/current slice                                                                                                                                                                                                                   | Open gap                                                                                                                          | Bucket             | Rationale                                                                                                                                                                                                                                              | Dependencies and next action                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Market price sync | Visible Settings/Economy loads committed static prices, generated high alch and read-only shared history, preserves local PriceSet/comparison controls and says automatic refresh is disabled.                                           | Keep production copy free of user-triggered refresh promises and stale `/api/prices`, `/api/scrape` or `run_sim.py` instructions. | `release-required` | Implemented for the accepted static market slice under D-099.                                                                                                                                                                                          | Keep the release-copy audit in [testing.md](testing.md) mandatory before release.                               |
| Market price sync | D-062 item-page adapter, coin-only offer mapping, robust estimator, request bounds and history compaction plus D-085 three-file price/provenance/history commit allowlist and the exact root Actions variable are implemented/evidenced. | An adopter validates a configured scheduled run for the current allowlist before relying on scheduled-current prices.             | `adopter-evidence` | Public crawler policy currently permits the accepted sequential reads. The parser skips item/mixed/ambiguous offers rather than guessing GP values; external run evidence cannot be proved by code. D-053/D-067 keep it outside repository acceptance. | Recheck crawler policy during operations; do not store raw pages, usernames or upstream dumps.                  |
| Market price sync | D-033/D-034 define the hardened schedule-only shape, while D-099 moves `.github/disabled-workflows/update-market-prices.yml` outside the active workflow directory.                                                                      | A future adopter accepts Actions capacity, restores the template and captures a successful scheduled run.                         | `adopter-evidence` | No active workflow exists. The retained template still has immutable actions, `contents: write`, no `workflow_dispatch`, output validation and commit-if-diff behavior.                                                                                | Re-review upstream/crawler policy, restore explicitly and validate the first run before scheduled-current copy. |
| Market price sync | Committed-static model with automatic refresh disabled.                                                                                                                                                                                  | Claiming production scheduled-current market prices for a concrete instance.                                                      | `adopter-evidence` | The UI can load static files, but D-099 makes production freshness explicitly inactive until a future operator restores and validates the schedule.                                                                                                    | Release notes must describe committed/imported/manual prices until a restored run is verified.                  |
| Market price sync | Static shared history plus separate browser-local comparison history.                                                                                                                                                                    | Backend-managed mutable history, database-backed history or account-backed price state.                                           | `decision-needed`  | D-033/D-064 explicitly choose committed read-only JSON and no database. A mutable shared-state model would be a new architecture decision.                                                                                                             | Keep shared JSON read-only in the browser and local comparisons local unless a new decision changes ownership.  |
| Market price sync | Same scheduled-static model.                                                                                                                                                                                                             | Legacy `/api/prices`, `/api/scrape`, current-monster scrape behavior and `market.js` mutation model.                              | `legacy-only`      | These are archived legacy/runtime behaviors, not production rewrite targets after [D-033](../project/decisions.md) and [D-044](../project/decisions.md).                                                                                               | Keep as archive evidence unless a future explicit legacy-runtime re-promotion decision changes the boundary.    |
| Market price sync | Same-origin market status/sync API, browser adapter and mocked tests remain compatibility scaffolding.                                                                                                                                   | Temporary `/api/prices` or `/api/scrape` shims for archived parity testing.                                                       | `legacy-only`      | D-044 accepts archive-only for legacy shims in the current rewrite path. The existing typed compatibility scaffolding may stay mocked/test-local, but no legacy shim routes should be added by default.                                                | Reopen only through an explicit legacy-runtime re-promotion decision.                                           |
| Hiscores          | Rewrite UI shows player input, same-origin status/lookup, validated adapter, preview/apply for combat skills and disabled/unavailable manual fallback copy without `run_sim.py` instructions.                                            | Preserve input validation, same-origin calls, timeout, rate-limit and sanitized-error boundaries for every provider runtime.      | `release-required` | These are required safety boundaries for the accepted hiscores workflow and current provider-enabled Vite implementation.                                                                                                                              | Keep provider wiring behind the existing contract; do not bypass validation in UI code.                         |
| Hiscores          | D-061 accepts the first-party 2004Scape JSON API and the server-only provider maps its type 1-7 rows. The parser accepts both the documented `date` field and the observed live shape that omits it.                                     | Keep the authoritative source contract fixture-backed and out of browser code.                                                    | `release-required` | The source/provider slice is implemented with fixed-origin, redirect, response-bound, schema and sanitized-error guards. The optional source timestamp is not used by the app.                                                                         | Keep provider tests mocked and update fixtures only against reviewed first-party contract evidence.             |
| Hiscores          | D-066 implements the same-origin production runtime as one Cloudflare Worker + Static Assets deployment with Worker-first `/api/*` and exact root paths.                                                                                 | An adopter connects its Cloudflare account/repository and verifies preview/production routing.                                    | `adopter-evidence` | Repository runtime/config/tests are complete; D-067 does not require an operated Cloudflare version for repository handoff.                                                                                                                            | Run the exact Cloudflare build/upload commands and deployed smoke before claiming live availability.            |
| Hiscores          | D-097 implements one deterministic SQLite Durable Object aggregate provider budget behind a one-second fail-closed gate; Wrangler binding/migration exists with committed mode `off`.                                                    | An adopter accepts a positive fixed-window provider quota, verifies D-065 account behavior and enables enforcement.               | `adopter-evidence` | WAF and Workers Rate Limiting counters are not global. The repository implementation stores aggregate count/window/config state only, but the exact quota and singleton load envelope are not inferred from code.                                      | Run the account-free dry-run now; enable only through the global rate-limit rollout/rollback checklist.         |
| Hiscores          | The source-backed provider is injected into Vite dev/preview and the Cloudflare Worker behind the same handler.                                                                                                                          | Deployed live lookup and upstream failure evidence for a concrete instance.                                                       | `adopter-evidence` | Local fixture and opt-in upstream evidence pass, but deployed behavior cannot be inferred from repository code alone.                                                                                                                                  | Collect sanitized Cloudflare preview evidence without committing player data.                                   |
| Hiscores          | D-065 forbids persistent player/query logs; D-066 disables Workers Logs observability and Logpush and emits no custom logs. Client address is only an ephemeral bounded rate-limit key.                                                  | The operator verifies account-side observability, Tail Workers and external drains remain off.                                    | `adopter-evidence` | Repository configuration closes the implementation gap, while account/dashboard state is environment evidence.                                                                                                                                         | Verify D-065 on the version preview before public lookup traffic.                                               |
| Hiscores          | Legacy `sim_hiscore_player` compatible import can seed the rewrite-owned last-player key.                                                                                                                                                | Legacy `run_sim.py` `/api/hiscores` UI instructions and missing-backend assumptions.                                              | `legacy-only`      | Archived `views.jsx` evidence can mention this path, but production rewrite copy must use service-aware status/manual fallback.                                                                                                                        | Keep classified through release-copy audit; do not add legacy copy to `src/app`.                                |

## Architecture decision boundary

The product decision accepts repo-owned integration boundaries and D-066 chooses
Cloudflare Workers + Static Assets for production Hiscores. Market price refresh
does not use a database or cache provider; it uses a retained local writer plus
static JSON artifacts, with automatic execution disabled under D-099. D-097 adds only one dedicated aggregate Hiscores
provider-budget Durable Object; it is not player storage, a general database or a
market-state change.

Acceptable implementation shapes for the first pass:

- Vite middleware for local development/preview
- the D-066 Cloudflare Worker fetch adapter for production
- explicitly restored schedule-only repo automation for market price files

The browser app should depend on typed adapters, not on the concrete server framework.

## API contract

Use same-origin JSON endpoints from the rewrite UI. The exact route prefix can change during implementation, but the contracts below should stay stable.

Common warning shape:

```ts
type IntegrationWarning = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  itemId?: string;
  skill?: HiscoresSkill;
};
```

### `GET /api/hiscores/status`

Returns whether the hiscores integration is available.

Response:

```ts
type HiscoresStatusResponse = {
  available: boolean;
  source: {
    id: string;
    label: string;
    url?: string;
  };
  limits?: {
    requestsPerMinute?: number;
  };
};
```

### `GET /api/hiscores?player=...`

Returns combat-relevant hiscores data for one player.

Response:

```ts
type HiscoresResponse = {
  player: string;
  normalizedPlayer: string;
  source: {
    id: string;
    label: string;
    url?: string;
  };
  fetchedAt: string;
  skills: Partial<Record<HiscoresSkill, HiscoresSkillValue>>;
  warnings: IntegrationWarning[];
};

type HiscoresSkill =
  "attack" | "strength" | "defence" | "hitpoints" | "prayer" | "ranged" | "magic";

type HiscoresSkillValue = {
  level: number;
  xp?: number;
  rank?: number;
};
```

Validation:

- `player` must be trimmed, non-empty and bounded before any upstream request.
- Levels must be integers from 1 to 99 before they can be applied to setup state.
- Unknown response fields from the upstream source must not flow into app state.

Error shape:

```ts
type IntegrationErrorResponse = {
  error: {
    code:
      | "bad-request"
      | "not-found"
      | "rate-limited"
      | "upstream-unavailable"
      | "upstream-invalid"
      | "internal-error";
    message: string;
    retryAfterSeconds?: number;
  };
  warnings?: IntegrationWarning[];
};
```

Accepted provider contract: D-061 fixes the first-party
`https://2004.lostcity.rs/api/hiscores/player/:username` JSON source and
`src/server/lostcity-hiscores-provider.ts` owns its bounded mapping behind the
same-origin API. A changed upstream contract requires reviewed provider and
schema evidence; the current repository implementation is not source-blocked.

### `GET /api/market/status`

Returns whether the market integration is available.

Response:

```ts
type MarketStatusResponse = {
  available: boolean;
  source: {
    id: string;
    label: string;
    origin?: string;
  };
  cache?: {
    enabled: boolean;
    ttlSeconds?: number;
  };
  limits: {
    maxItemsPerRequest: number;
    requestsPerSecond: number;
  };
};
```

After [D-033](../project/decisions.md), production market availability can be satisfied by validated scheduled static price files. A same-origin status endpoint may still report the active static snapshot source, age and schedule status, but it must not imply that users can trigger upstream refresh.

### `POST /api/market/sync`

Refreshes prices for an explicit allowlisted item set.

Decision note: this endpoint exists in the current dev/preview and mocked test boundary, but it is not the accepted production writer after [D-033](../project/decisions.md). Production must not expose a user-triggered upstream market refresh. Keep or remove this endpoint later based on compatibility needs; if it remains, it should read/return scheduled static snapshot data rather than fetching upstream on demand.

Request:

```ts
type MarketSyncRequest = {
  scope: "monster" | "all-supported" | "items";
  monsterId?: string;
  itemIds?: string[];
  includeAlch?: boolean;
};
```

Response:

```ts
type MarketSyncResponse = {
  priceSet: PriceSet;
  report: MarketSyncReport;
};

type MarketSyncReport = {
  requested: number;
  updated: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
  source: {
    id: string;
    label: string;
    origin?: string;
  };
  items: MarketItemReport[];
  warnings: IntegrationWarning[];
};

type MarketItemReport = {
  itemId: string;
  sourceSlug?: string;
  status: "updated" | "skipped" | "failed";
  price?: number;
  alchValue?: number;
  sampleSize?: number;
  reason?: string;
};
```

`PriceSet` is the existing rewrite economy contract. For synced prices it should use:

```ts
{
  source: "scraped",
  createdAt: string,
  itemPrices: Record<ItemId, number>,
  alchValues: Record<ItemId, number>
}
```

Compatibility note: [D-044](../project/decisions.md) keeps legacy `/api/prices` and `/api/scrape` shims archive-only for the current rewrite path. The rewrite UI should keep using typed endpoints/static scheduled data; add temporary legacy shims only after an explicit legacy-runtime re-promotion decision.

## Market source mapping

The rewrite replaces the legacy `SLUG_MAP` constant with validated data that maps its bounded simulator item allowlist to approved market source slugs.

Target shape:

```ts
type MarketSourceMapping = {
  itemId: string;
  sourceSlug: string;
  source: "markets.lostcity.rs";
  tradeable: boolean;
  syncPrice: boolean;
  syncAlch: boolean;
  notes?: string;
};
```

Rules:

- The server accepts only item ids present in this mapping.
- The browser never submits arbitrary upstream URLs or slugs.
- Nested loot rows and tagged drops must be expanded through `GameDataSnapshot`, not through legacy array flattening assumptions.
- Static prices, skipped drops, buried bones and alch-only rows must be intentionally marked.
- Gem, casket, herb, supply and recoil dependencies must be represented as data, not special cases hidden in UI code.

Current implementation note: the original 80-row bounded allowlist was audited on 2026-07-10 against the public `markets.lostcity.rs/api/items?q=...` catalog using generated item names. Ambiguous dragonhide rows use their canonical color-specific item ids, and generated source identities resolve `keyhalf1` as tooth and `keyhalf2` as loop. D-087 adds twelve identified dynamic-loot rows after bounded item-page and existing-parser review; `rune_2h` maps to `rune_2h_sword`. Ten non-guam species-specific unidentified-herb paths returned 404 and remain outside the current 92-row allowlist. Broader item-universe mapping remains a later scope decision.

Ordinary casket component refresh remains part of this market dependency
boundary, while the pure opened-content formula, source weights and parent-row
override rule belong to the implemented
[source-backed casket valuation specification](source-backed-casket-valuation-spec.md).
The parent `casket` source slug must not silently replace opened-content EV.

## UI behavior

### Hiscores

Recommended flow:

1. User enters a player name.
2. UI calls `GET /api/hiscores`.
3. UI shows fetched skills and source timestamp.
4. User applies all combat skills, or applies selected skills if that control is added.
5. Form state updates through the same typed setup reducer as manual level edits.

The UI must not claim hiscores are unavailable simply because the app is not running on `localhost`. It should use `GET /api/hiscores/status` service availability or handle the hiscores endpoint response directly.

Current implementation note: the rewrite follows this flow through the global header Player lookup. `GET /api/hiscores/status` drives the visible availability state; `GET /api/hiscores?player=...` returns a validated bounded preview popover; Apply mutates only genuinely changed returned skills after verifying the preview still matches the normalized current Player input. A changed batch exposes one exact form Undo through the global strip, while stale and zero-change attempts do not replace an earlier action. Apply and Undo retain the current response and disclosure state, so Current values follow the live form without another lookup. The popover opens for a successful response, closes on `Escape`, an outside pointer action or its own summary control, and returns focus to the summary after `Escape`. Missing returned skills leave existing manual levels unchanged.
When the status endpoint reports a disabled provider or unavailable service, the player-name input remains visible for continuity with the live workflow but Lookup stays disabled. The user-facing copy points to the Player level fields for manual editing, and the unavailable state must not clear or overwrite those manual levels.

### Market prices

Recommended production flow:

1. UI loads bundled generated game data and price fallbacks.
2. UI loads the latest scheduled market prices from `prices.json` and read-only history from `price-history.json` when available.
3. UI combines the selected market prices with authoritative generated high-alch values and validates the resulting PriceSet.
4. UI selects persisted local prices, otherwise scheduled prices, otherwise bundled prices.
5. UI shows source, timestamp, age, warnings and shared/local history counts.
6. UI keeps file import and local comparison capture available when scheduled prices are missing, stale or invalid.

The Settings/Economy UI should keep file import available even when the live service is down.

Current implementation note: JSON price import remains available in the topbar, Settings and Economy. Imported market prices receive generated alch values before acceptance. The UI offers local import/export/reset, `Save local comparison` and `Clear local history`; it never offers an upstream refresh. Missing or invalid scheduled files are non-fatal and leave the selected or bundled fallback active. Shared history remains available after local history is cleared.

## Persistence

Use new rewrite-owned storage keys. Do not write legacy keys from the rewrite path.

Suggested keys:

- `index-sim:hiscores:last-player`
- `index-sim:price-set:selected`
- `index-sim:price-history`

All persisted values must use the existing `PersistedEnvelope<T>` pattern.

Current implementation note: `index-sim:price-set:selected` stores the active validated local market-price override after generated alch composition. Restore repeats that composition and does not append history. `index-sim:price-history` stores only capped local comparisons with `capturedAt`, `sourcePriceSetId`, `label` and `itemPrices`; it never stores upstream pages, source slugs, usernames or secrets. Validated shared `price-history.json` rows are converted into read-only in-memory analysis snapshots. Local clear/reset actions cannot change the shared file.

Legacy compatibility note: the user-facing legacy import flow can read `sim_hiscore_player` and compatible `sim_prices_v1` market prices. It validates `sim_alch_v1` for legacy completeness but replaces those values with current generated alch before accepting the PriceSet. Import keeps legacy keys. `sim_price_history_v1` is detected and reported but not migrated; account/server-managed or full legacy history migration still needs a separate decision.

## Security and privacy

Requirements:

- Same-origin browser calls only.
- Server-side upstream allowlist only.
- No user-triggered upstream market refresh.
- Market upstream calls are scheduler-only.
- No arbitrary URL, host, path or slug from browser input.
- Bounded request body size.
- Bounded item count per sync.
- Rate limiting per runtime instance plus D-097's implemented, disabled strict-global Hiscores gate; activation and any distributed WAF claim follow [hiscores-global-rate-limit-spec.md](hiscores-global-rate-limit-spec.md).
- Timeouts on upstream requests.
- Sanitized error messages that do not expose filesystem paths, stack traces or raw upstream bodies.
- No secrets required for the first implementation.
- Player names are request data; do not log them in persistent app logs unless operations explicitly accepts that policy.
- CSP `connect-src` must include only the app origin and the approved upstream origin if browser-side status probes are ever added.

The preferred design keeps upstream market and hiscores requests server-side so production CSP can keep browser `connect-src` on same-origin for these features.

## Testing requirements

Unit tests:

- validate hiscores player input and skill response parsing
- reject invalid hiscores payloads with sanitized errors
- validate market sync request body limits and allowlist behavior
- expand current-monster and all-supported item sets from `GameDataSnapshot`
- map item ids to market slugs without legacy `SLUG_MAP` globals
- parse upstream market fixture payloads into `PriceSet`
- preserve partial market failures in `MarketSyncReport`
- validate scheduled `prices.json`/`price-history.json`, generated alch composition and the read-only loader/status fallback contract

Adapter tests:

- mock successful hiscores lookup
- mock not-found, rate-limited and upstream-invalid hiscores responses
- mock current-monster market sync
- mock all-supported market sync with partial failures
- verify returned market data passes `PriceSetSchema`

UI tests:

- hiscores lookup previews and applies returned levels
- hiscores failure leaves manual levels unchanged
- market sync applies a returned `PriceSet`
- market sync failure keeps current `PriceSet`
- accepted imported or synced `PriceSet` records browser-local price history
- accepted imported, compatible legacy or synced `PriceSet` persists as the selected active `PriceSet` across reloads without adding a restore-time history snapshot
- failed import or failed sync keeps browser-local price history unchanged
- reset to bundled clears only `index-sim:price-set:selected`; export produces JSON accepted by the `PriceSet` import parser
- file import still works when live service is unavailable
- scheduled static price load failure keeps bundled/import fallback available

No automated test should call live upstream services. Use fixtures and mocked fetches for repeatability.

## Implementation phases

### Phase 1: contracts and fixtures

- Add shared TypeScript types for hiscores and market integration responses.
- Add fixture payloads for hiscores and market upstream responses.
- Add tests for validation, item expansion and source mapping.
- Do not change visible UI behavior yet.

Implementation note: the original contract/fixture slice remains in
`src/domain/shared`, `src/data/schemas/live-integrations.ts`,
`src/data/market-source-mapping.ts` and `src/tests/live-integrations.test.ts`.
Later phases implemented the repo-owned handlers, adapters, UI wiring,
Cloudflare runtime and retained market writer described below. Default tests
still use fixtures or mocked fetches and do not call live upstream services.

### Phase 2: same-origin integration service

- Add repo-owned handlers for the typed API contract.
- Add upstream allowlists, timeouts, rate limits and sanitized errors.
- Do not add production user-triggered market upstream refresh.
- Keep general databases and player caches out of scope for the same-origin service; D-097's dedicated aggregate rate state is the only accepted exception.

Current hiscores implementation note: `src/server/hiscores-core.ts` provides a framework-neutral status/lookup handler and `src/server/vite-hiscores-middleware.ts` exposes it in Vite dev/preview. The handler validates player input, uses a per-process client limit, checks an asynchronous one-second provider-budget gate, enforces a provider timeout and returns sanitized `IntegrationErrorResponse` payloads for bad-request, not-found, rate-limited, upstream-unavailable, upstream-invalid and internal-error paths. Local/default runtimes use an allow-all gate. D-097's Cloudflare adapter injects one deterministic SQLite Durable Object aggregate gate with committed mode `off`; no default test performs a live upstream call.

Current market implementation note: `src/server/market-core.ts` provides a framework-neutral status/sync handler and `src/server/vite-market-middleware.ts` exposes it in Vite dev/preview. The handler validates body size, request JSON, item count, item allowlist and same-origin request shape; expands current-monster/all-supported item sets through `src/data/market-sync-items.ts`; enforces a per-process sync rate limit and provider timeout; and returns sanitized `IntegrationErrorResponse` payloads. The default provider is disabled and performs no live upstream call.

Decision update: this handler remains useful for mocked tests and local compatibility, but D-033 makes production prices static JSON. D-062 implements and live-validates the catalog/item-page contract plus robust estimator, D-063 moves high alch to generated game data and D-064 exposes static shared history read-only. D-099 disables the automatic Actions path while retaining its hardened template. A scheduled-current description requires a later explicit restore and successful-run evidence.

### Phase 2b: market snapshot writer and disabled scheduler

- Fetch approved market data from `markets.lostcity.rs` on a fixed schedule.
- Generate the validated `prices.json`, `price-provenance.json` and
  `price-history.json` logical set; do not write `alch.json`.
- Retain 12-hour shared history for 90 days, then one latest point per older UTC day.
- Validate the generated files with the data/economy schemas and relevant tests.
- Commit only when the generated JSON differs.
- Retain the GitHub Actions cron shape at 00:15 and 12:15 UTC outside `.github/workflows`; restore it only through an explicit D-099 capacity decision.
- Use the repository `GITHUB_TOKEN` with `contents: write`; do not add a separate app token unless the default token cannot satisfy the commit path.
- Omit `workflow_dispatch` so users cannot trigger upstream refresh manually through GitHub UI.
- Keep credentials in repo automation, not in the browser app.
- Do not add a database or user-triggered upstream refresh.

Current implementation note: `scripts/write-scheduled-market-prices.ts` is the retained local entrypoint, `scripts/scheduled-market-writer-core.ts` owns estimation/history and `scripts/markets-lostcity-item-page-adapter.ts` parses the first Inertia `soldListings` page for each allowlisted mapping. D-099 leaves no active GitHub workflow. `--upstream-url` must be the exact root `https://markets.lostcity.rs/`; the writer derives item paths, runs requests sequentially with a 350 ms delay, maps only explicit prices or one coin-only offer and drops usernames before normalized data reaches the estimator. Item swaps, mixed offers and multiple offers are skipped. A mapping-specific 404 retains the prior value and appears in the report; other HTTP/network/schema failures stop the run. `--input` remains the normalized fixture/dev path. Its contract is:

```ts
type ScheduledMarketWriterInput = {
  source?: "markets.lostcity.rs";
  fetchedAt?: string;
  items: Array<{
    itemId: string;
    sourceSlug: string;
    status?: "updated" | "skipped";
    reason?: string;
    price?: number;
    history?: Array<{
      price: number;
      quantity?: number;
      type?: "buy" | "sell";
      soldAt?: string;
    }>;
  }>;
};
```

Rows are matched by approved `itemId` and `sourceSlug`; unknown, duplicate, mismatched or missing rows fail before any write. Completed buy and sell listings count as one observation each regardless of quantity. At least five observations use median absolute deviation filtering; three or four use a three-times median ratio guard. The writer averages at most the newest five accepted rows, retains the previous price below three accepted rows, ignores rows older than 90 days and retains when the newest accepted row is older than 30 days. Fixed-origin, root-path, credential/query/fragment, redirect, per-response timeout and byte limits fail closed with sanitized errors. The writer validates the `prices.json`, `price-provenance.json` and version-2 `price-history.json` candidate set in memory, writes deterministic JSON only after validation and skips unchanged files. The archived workflow template rejects any diff outside that three-file set if explicitly restored. Tests are mocked/fixture-based and never call the live source.

Freshness model: `_scraped_at` and `price-provenance.json.capturedAt` are matching set-capture times, while each item estimate requires at least three accepted trades and a latest accepted trade no older than 30 days. Report quality is high for ten accepted observations no older than seven days, medium for five or more accepted/recent observations, low for three or four and retained when no new value is accepted. Item observation and evaluation timestamps stay in the provenance/history rows rather than being inferred from capture time. The latest commit touching the three-file set is the latest accepted file change. While D-099 is active there is no workflow-run freshness evidence; a restored failed run would leave the previous logical set active.

Implemented provenance correction: [the per-item price provenance and freshness specification](per-item-price-provenance-freshness-spec.md) persists item status without treating `_scraped_at` as every item's observation time. D-085 adds `price-provenance.json`, versioned shared history and safe PriceSet/browser-storage migration; the validated three-file writer and loader are current production truth.

Current live evidence: public crawler policy permitted bounded sequential item-page reads at the recorded review. The original 80-item catalog-audited allowlist passed a full dry-run with 69 updated plus 11 retained/skipped mappings without writes on 2026-07-10. D-087's twelve-item expansion passed a separate no-write parser dry-run with eight updated plus four retained/skipped mappings on 2026-07-12. The exact root `MARKET_PRICES_UPSTREAM_URL` variable was configured and verified by repository readback. D-099 now disables the workflow; a future operator must re-review policy, restore it and record a successful current-allowlist run before any scheduled-current claim. Raw pages and usernames remain uncommitted and unlogged.

### Phase 3: rewrite adapters

- Add `src/adapters/hiscores`.
- Extend `src/adapters/market` to call the typed sync endpoint.
- Validate every returned payload before it reaches app state.
- Keep imported file parsing as the offline fallback.

Current implementation note: `src/adapters/hiscores` validates status, success and error payloads before they reach app state. `src/adapters/market` validates market status, sync success and sync error payloads before they reach app state, and also exposes the read-only scheduled static price snapshot loader/status contract for same-origin static JSON files. The existing file import parser remains the offline fallback and uses `PriceSetSchema`.

### Phase 4: UI wiring

- Add hiscores lookup to the rewrite setup workflow.
- Add market status and sync controls to Settings/Economy.
- Add user-visible progress, partial failure summaries and source timestamps.
- Remove or replace stale `python run_sim.py` copy from production UI paths.

Current implementation note: hiscores lookup is wired into the rewrite Levels preview/apply workflow. Market prices are wired through committed static status and local overrides, generated high alch and shared/local Economy history. Settings and Economy expose export and local reset controls; reset keeps both shared and local history. Hiscores still uses service-aware states from same-origin endpoints, and D-099 market production copy says automatic refresh is disabled.

### Phase 5: parity and cleanup

- Add browser smoke coverage for both features with mocked endpoints.
- Update [rewrite-parity-report.md](rewrite-parity-report.md) once there is evidence.
- Keep legacy `/api/*` compatibility shims archive-only under D-044 unless a future explicit legacy-runtime re-promotion decision changes the boundary.
- Keep `legacy/index.html` archived until the broader legacy-removal decision is accepted.

## Acceptance criteria

Hiscores is acceptable when:

- a user can fetch and apply combat levels from the approved hiscores source
- unavailable or invalid upstream responses do not mutate setup state
- returned skills are schema-validated and clamped by explicit validation rules
- UI copy no longer points users to missing `run_sim.py`
- unit and UI tests cover success, not-found and failure paths

Current status: the same-origin API, browser adapter, UI apply flow, approved
provider and Cloudflare production runtime meet the repository implementation
criteria with mocked/provider/Worker tests. Full acceptance still requires
Cloudflare account connection and deployed privacy/routing/live evidence.

Market sync is acceptable when:

- the retained writer can produce validated latest prices and retained 12-hour history snapshots; D-099 keeps automatic execution disabled
- the app can load the latest scheduled data as a valid explicit `PriceSet`
- simulation results depend on the selected `PriceSet`, not hidden global mutation
- source, timestamp, age and warnings are shown
- file import remains available as an offline fallback
- tests cover mapping, validation, generated JSON files and UI load/fallback behavior

Current status: the same-origin compatibility API, disabled-refresh UI, imported-price fallback, selected PriceSet persistence, generated alch authority, read-only shared history, local comparisons, item-page writer, catalog mapping and robust estimator are implemented with mocked/fixture tests plus a successful full live dry-run. D-099 moves the hardened workflow template outside `.github/workflows`. The visible Market/Economy workflow remains `Valmis`; scheduled-current acceptance requires a later explicit restore and successful configured GitHub Actions run.

## Open questions

- Which custom domain, if any, should be added after the D-066 provider preview passes?
- Does the connected Cloudflare account show Workers Logs, Logpush, Tail Workers and external drains disabled as configured?
- If D-062's accepted first-page `markets.lostcity.rs/items/{slug}` Inertia contract changes, what reviewed replacement contract and migration evidence should supersede it?

D-049/D-063 close the current legacy market-storage boundary: compatible
current prices may import, generated alch values win, scrape metadata clears
only on confirmed Clear and full legacy price history remains
review-only/not migrated. Changing that policy requires a new explicit
product/storage decision rather than more implementation under this spec.

# Live integrations specification

- Status: implementation target specification
- Date: 2026-07-05
- Owner: technical docs
- Related decision: [D-015](../project/decisions.md)
- Legacy evidence: `views.jsx` `HiscoresLookup`, `views.jsx` `SettingsPane`, `market.js`

## Purpose

Hiscores lookup and live market sync are accepted product features, not static-only behavior, local-dev-only helpers or removal candidates. The current repo does not contain the legacy `run_sim.py` backend, so this spec defines the product behavior and API boundary needed to implement those features in the rewrite.

The implementation must preserve the useful legacy workflows while replacing the fragile parts:

- stale `python run_sim.py` UI instructions
- browser-global `window.*` price mutation
- ad hoc `/api/prices`, `/api/scrape` and `/api/hiscores` calls with no repo-owned server source
- direct browser scraping where CORS and upstream HTML changes can break behavior
- unvalidated market keys and localStorage-driven reproducibility drift

## Product scope

### Hiscores lookup

Users can enter a player name, fetch combat-relevant stats from an approved hiscores source and apply the returned levels to the simulator setup.

Product decision: hiscores is required for v1 replacement, but the authoritative API/source and final hosting model remain open while an upstream API answer is pending.

Known candidate evidence:

- `https://2004.lostcity.rs/hiscores/player/index` returns player hiscore data as HTML.
- Direct browser fetch from a different origin has not been accepted as the architecture because the final API/CORS answer is still pending.
- Keep the UI and domain depending on the repo-owned hiscores adapter contract, not directly on upstream HTML.

MVP behavior:

- visible in the rewrite UI wherever level editing lives
- fetches Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic
- previews fetched levels before applying or clearly reports what changed
- applies only returned skills; missing skills do not reset existing levels
- stores the last searched player name locally only when browser storage is available
- provides understandable empty, not-found, rate-limited and service-unavailable states

Current implementation note: the rewrite UI now exposes player input, service status, lookup, preview and Apply for these seven skills. It calls the same-origin hiscores API through `src/adapters/hiscores`, stores the last searched player with the rewrite `PersistedEnvelope<T>` helper and never calls a live upstream directly from the browser. The default repo provider remains disabled until an authoritative upstream is accepted.

### Live market sync

Users can refresh item prices and high-alch values from an approved market source, then run simulations with the refreshed `PriceSet`.

Accepted target source: `markets.lostcity.rs`.

Accepted history direction: keep a latest price set plus retained 12-hour price history snapshots once the refresh writer is implemented. Browser-local accepted-price history is implemented as local UI state; the exact shared automation, storage path and deploy/hosting mechanism remain open.

MVP behavior:

- keeps existing file import as an offline fallback
- syncs prices for the current monster
- syncs the full supported loot/supply item allowlist
- returns a validated `PriceSet` that the app can select explicitly
- shows source, fetched time, updated count, skipped count and failed count
- preserves missing-price warnings instead of silently mutating fallback data
- updates browser-local price history only after a validated price set is accepted by the UI

Current implementation note: the rewrite UI now exposes current-monster and all-supported sync controls in the Loot and Economy panes. It calls the same-origin market API through `src/adapters/market`, validates the returned `MarketSyncResponse` and swaps the selected explicit `PriceSet` only after validation succeeds. A validated imported or synced `PriceSet` records a capped browser-local snapshot in `index-sim:price-history` after the UI accepts it as active; failed imports, failed syncs and invalid payloads do not update that history. The Economy tab can also capture the currently active validated `PriceSet` with Snapshot now, analyze local movers against Previous, First or an explicit snapshot baseline and clear only the local history key after confirmation. The default repo provider remains disabled until an authoritative market upstream is accepted.

## Non-goals for the first implementation

- user accounts or authentication
- database-backed saves
- public third-party API guarantees
- arbitrary URL scraping
- browser-side scraping of upstream HTML
- server-managed shared price history
- changing simulation math while adding the integrations

Scheduled server market jobs remain out of scope. Static or repo-automation generated price snapshots are an accepted target only after a separate refresh workflow is implemented and reviewed; the first live integration implementation should still work with explicit user-triggered sync plus the existing bundled/imported price paths.

## Architecture decision boundary

The product decision accepts a repo-owned live integration boundary. It does not yet choose a backend framework, hosting model, database or cache provider.

Acceptable implementation shapes for the first pass:

- a small same-origin development/preview service owned by this repo
- Vite dev middleware plus equivalent production adapter once hosting is selected
- serverless functions if deployment chooses a serverless host

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

Open question: the authoritative 2004scape hiscores upstream URL and response format are not present in this repo. Implementation must verify and document the approved source before shipping.

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

### `POST /api/market/sync`

Refreshes prices for an explicit allowlisted item set.

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

Compatibility note: legacy `/api/prices` and `/api/scrape` may be implemented as temporary shims for archived parity testing, but the rewrite UI should call the typed market endpoints above.

## Market source mapping

Replace the legacy `SLUG_MAP` constant with validated data that maps simulator item ids to approved market source slugs.

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

Open question: the canonical source for the complete item-id-to-market-slug map is not present in this repo.

## UI behavior

### Hiscores

Recommended flow:

1. User enters a player name.
2. UI calls `GET /api/hiscores`.
3. UI shows fetched skills and source timestamp.
4. User applies all combat skills, or applies selected skills if that control is added.
5. Form state updates through the same typed setup reducer as manual level edits.

The UI must not claim hiscores are unavailable simply because the app is not running on `localhost`. It should use `GET /api/hiscores/status` service availability or handle the hiscores endpoint response directly.

Current implementation note: the rewrite follows this flow through the Levels panel. `GET /api/hiscores/status` drives the visible availability state; `GET /api/hiscores?player=...` returns a validated preview; Apply mutates only returned skills in the current setup model. Missing returned skills leave existing manual levels unchanged.

### Market sync

Recommended flow:

1. UI loads bundled prices into an explicit `PriceSet`.
2. User chooses current-monster sync or all-supported sync.
3. UI calls `POST /api/market/sync`.
4. UI validates the returned `PriceSet` with the same schema used by file import.
5. UI selects the new `PriceSet` for simulations and records browser-local price history.
6. UI surfaces partial failures without discarding successful validated prices.

The Settings/Economy UI should keep file import available even when the live service is down.

Current implementation note: the rewrite keeps JSON price import in the topbar as the offline fallback. Market sync shows service availability, source, fetched timestamp and updated/skipped/failed counts. Partial failures keep successful validated prices and do not discard the returned `PriceSet`.

## Persistence

Use new rewrite-owned storage keys. Do not write legacy keys from the rewrite path.

Suggested keys:

- `index-sim:hiscores:last-player`
- `index-sim:price-set:selected`
- `index-sim:price-history`

All persisted values must use the existing `PersistedEnvelope<T>` pattern.

Current implementation note: `index-sim:price-history` stores a versioned rewrite-owned envelope containing capped snapshots with `capturedAt`, `sourcePriceSetId`, `label` and `itemPrices`. It does not store upstream origins, source slugs, raw response bodies, player names or secrets. The current Economy UI reads this local envelope for summary and movers analysis, and its Clear history action removes only this key.

Legacy compatibility note: the user-facing legacy import flow can read `sim_hiscore_player` into the rewrite-owned last-player key after current hiscores validation, and can convert compatible `sim_prices_v1` + `sim_alch_v1` + `sim_scraped_at_v1` data into an explicit imported `PriceSet` after price schema and known-item validation. Import keeps the legacy keys. `sim_price_history_v1` is detected and reported but not migrated; server-managed or full legacy price history migration still needs a separate decision.

## Security and privacy

Requirements:

- Same-origin browser calls only.
- Server-side upstream allowlist only.
- No arbitrary URL, host, path or slug from browser input.
- Bounded request body size.
- Bounded item count per sync.
- Rate limiting per process or deployment unit.
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
- failed import or failed sync keeps browser-local price history unchanged
- file import still works when live service is unavailable

No automated test should call live upstream services. Use fixtures and mocked fetches for repeatability.

## Implementation phases

### Phase 1: contracts and fixtures

- Add shared TypeScript types for hiscores and market integration responses.
- Add fixture payloads for hiscores and market upstream responses.
- Add tests for validation, item expansion and source mapping.
- Do not change visible UI behavior yet.

Current implementation note: the first contract/fixture slice exists in `src/domain/shared`, `src/data/schemas/live-integrations.ts`, `src/data/market-source-mapping.ts` and `src/tests/live-integrations.test.ts`. It adds validation and mocked fixtures only; it does not add UI, backend runtime, hosting, scheduled jobs or live upstream calls.

### Phase 2: same-origin integration service

- Add repo-owned handlers for the typed API contract.
- Add upstream allowlists, timeouts, rate limits and sanitized errors.
- Add in-memory cache if needed to keep user-triggered sync responsive.
- Keep database and scheduled jobs out of scope.

Current hiscores implementation note: `src/server/hiscores-core.ts` provides a framework-neutral status/lookup handler and `src/server/vite-hiscores-middleware.ts` exposes it in Vite dev/preview. The handler validates player input, uses a per-process lookup rate limit, enforces a provider timeout and returns sanitized `IntegrationErrorResponse` payloads for bad-request, not-found, rate-limited, upstream-unavailable, upstream-invalid and internal-error paths. The default provider is disabled and performs no live upstream call.

Current market implementation note: `src/server/market-core.ts` provides a framework-neutral status/sync handler and `src/server/vite-market-middleware.ts` exposes it in Vite dev/preview. The handler validates body size, request JSON, item count, item allowlist and same-origin request shape; expands current-monster/all-supported item sets through `src/data/market-sync-items.ts`; enforces a per-process sync rate limit and provider timeout; and returns sanitized `IntegrationErrorResponse` payloads. The default provider is disabled and performs no live upstream call.

### Phase 3: rewrite adapters

- Add `src/adapters/hiscores`.
- Extend `src/adapters/market` to call the typed sync endpoint.
- Validate every returned payload before it reaches app state.
- Keep imported file parsing as the offline fallback.

Current implementation note: `src/adapters/hiscores` validates status, success and error payloads before they reach app state. `src/adapters/market` validates market status, sync success and sync error payloads before they reach app state. The existing file import parser remains the offline fallback and uses `PriceSetSchema`.

### Phase 4: UI wiring

- Add hiscores lookup to the rewrite setup workflow.
- Add market status and sync controls to Settings/Economy.
- Add user-visible progress, partial failure summaries and source timestamps.
- Remove or replace stale `python run_sim.py` copy from production UI paths.

Current implementation note: hiscores lookup is wired into the rewrite Levels workflow with preview/apply behavior. Market status/sync is wired into the rewrite Loot and economy workflow with current-monster and all-supported controls plus report summary. The Market panel also shows browser-local price history summary: snapshot count, tracked item count, latest age and active/latest labels. Both features use service-aware `available`, `unavailable` and disabled-runtime states from same-origin status endpoints; production rewrite copy does not instruct users to run `python run_sim.py`.

### Phase 5: parity and cleanup

- Add browser smoke coverage for both features with mocked endpoints.
- Update [rewrite-parity-report.md](rewrite-parity-report.md) once there is evidence.
- Decide whether any legacy `/api/*` compatibility shims still matter.
- Keep `legacy/index.html` archived until the broader legacy-removal decision is accepted.

## Acceptance criteria

Hiscores is acceptable when:

- a user can fetch and apply combat levels from the approved hiscores source
- unavailable or invalid upstream responses do not mutate setup state
- returned skills are schema-validated and clamped by explicit validation rules
- UI copy no longer points users to missing `run_sim.py`
- unit and UI tests cover success, not-found and failure paths

Current status: the same-origin API, browser adapter and UI apply flow meet the validation and mutation-safety parts with mocked/provider tests. Full acceptance still requires the approved hiscores upstream source and production runtime/hosting decision.

Market sync is acceptable when:

- a user can sync current-monster and all-supported prices through the rewrite UI
- the returned data is a valid explicit `PriceSet`
- simulation results depend on the selected `PriceSet`, not hidden global mutation
- partial failures are visible and do not discard successful prices
- source, timestamp and updated/skipped/failed counts are shown
- file import remains available as an offline fallback
- tests cover mapping, validation, partial failures and UI apply/failure behavior

Current status: the same-origin API, browser adapter, UI sync flow and browser-local accepted-price history meet the validation, explicit `PriceSet`, partial-failure, offline-import and local-history parts with mocked/provider tests. Full acceptance still requires the approved market upstream source and production runtime/hosting decision.

## Open questions

- Which concrete backend/runtime should host the same-origin API?
- What is the production deployment target?
- What is the authoritative hiscores upstream source?
- What is the authoritative market API or scrape contract for `markets.lostcity.rs`?
- What exact workflow writes the accepted 12-hour latest/history price snapshots?
- Should remaining legacy market localStorage keys, especially full price history and unsupported metadata keys, be migrated or intentionally ignored?
- Should temporary `/api/prices` and `/api/scrape` shims be kept for legacy parity testing?

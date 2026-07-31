# Market compatibility scaffolding retirement specification

- Status: active
- Date: 2026-07-31
- Owner: market adapter and local server boundary
- Evidence: partial
- Contract: living

## Purpose

Remove the unused interactive market status/sync compatibility surface from
normal development while preserving committed static prices, imports, manual
overrides, provenance, history and the disabled scheduled writer.

The visible product does not offer upstream refresh. The current Vite server
still installs market API middleware and the browser adapter still exports
status/sync clients. This specification verifies external consumers first and
then removes only that unused compatibility surface.

## Verified starting state

- The accepted product model is committed scheduled-static JSON plus
  browser-local PriceSets and manual overrides.
- D-099 disables the scheduled GitHub Actions workflow.
- Product copy exposes no user-triggered upstream market refresh.
- `vite.config.ts` installs `marketApiPlugin()` for dev and preview.
- `src/server/market-core.ts` owns `GET /api/market/status` and
  `POST /api/market/sync`.
- `src/adapters/market/index.ts` exports `fetchMarketStatus()` and
  `syncMarketPrices()`.
- Repository search finds no non-test application caller for those two client
  functions.
- The Cloudflare Worker routes Hiscores and returns sanitized 404 for other API
  paths; it does not expose the market sync/status handler.
- Technical documentation calls the API “compatibility scaffolding” and says
  interactive refresh is not a production target.
- The same market adapter module also owns required static price loading,
  PriceSet parsing/import and shared-history validation; the module cannot be
  deleted wholesale.

## Consumer checkpoint

Before removal:

1. Search application, scripts, tests and docs for both paths and exported
   functions.
2. Ask the known tester/maintainer whether any local tool calls the dev/preview
   endpoints.
3. Inspect any documented demo, handoff or browser fixture that claims mocked
   market sync.
4. Confirm no public API contract or third-party consumer has been promised.
5. Record the result as `no-consumer`, `known-consumer` or `unknown`.

If a consumer is known or unknown, do not remove the endpoint. First decide
whether it is a supported developer API, replace it with a direct writer/static
fixture command, or preserve it with a named owner and sunset trigger.

## 2026-07-31 implementation checkpoint

Classification: `unknown`.

Repository evidence proves there is no current application or package-script
caller for `fetchMarketStatus()`, `syncMarketPrices()` or the two
`/api/market/*` paths. Runtime bootstrap loads the four committed static files
directly, and Cloudflare does not route the compatibility handler.
`market-scaffolding-boundary.test.ts` now freezes that product boundary.

External consumer state is not provable from the checkout. The endpoints were
introduced with the original rewrite commit, and no owner evidence confirms
whether the known tester or a maintainer-local tool calls the Vite-only
surface. Therefore the middleware, handler, schemas, types and compatibility
tests remain intact. Removal scope below activates only after a human records
`no-consumer`; a `known-consumer` result instead requires a named owner and
replacement/sunset decision.

## Removal scope for `no-consumer`

Remove:

- `marketApiPlugin()` from Vite dev/preview configuration;
- `src/server/vite-market-middleware.ts`;
- interactive status/sync routing and in-memory request rate limiting from
  `src/server/market-core.ts`, deleting the module if no other responsibility
  remains;
- `fetchMarketStatus()` and `syncMarketPrices()` plus client-only error mapping
  that has no other consumer;
- live-integration request/response schemas and domain types used only by the
  retired API;
- mocked endpoint tests and browser scenarios whose only purpose is proving the
  compatibility API exists;
- architecture external-entrypoint declarations for removed middleware; and
- docs that describe the endpoint as current scaffolding.

Preserve:

- loading and validating `prices.json`, `price-provenance.json`,
  `price-history.json` and generated high alch;
- bundled/generated PriceSet fallback;
- PriceSet file import/export and complete-replacement review;
- manual per-item overrides;
- browser-local price history and Workspace transfer;
- static writer/parser/mapping/provenance tooling;
- disabled scheduler template and its security contract;
- market source mappings used by the writer or dynamic dependency reports; and
- sanitized static-data failure/recovery UI.

## Module target

After removal, the browser market adapter should have one clear static/file
responsibility. If the remaining module is still broad, split only along these
already-demonstrated seams:

```text
static-price-snapshot loader
PriceSet file parser/transfer
shared-price-history loader
```

Do not retain an `integration` or `sync` compatibility facade with no runtime
consumer. Do not move writer-side upstream fetch code into the browser.

## Test replacement

Replace interactive sync fixtures with direct current-contract tests:

- scheduled snapshot loaded;
- invalid/missing snapshot keeps a safe fallback;
- provenance keys/timestamps match prices;
- imported/current/manual PriceSet precedence remains exact;
- shared history stays read-only;
- local history and manual overrides remain browser-local; and
- production/development UI contains no refresh promise or control.

The Vite/startup suite must continue to test direct GET/HEAD handling for the
four static price files. It must assert that retired `/api/market/*` routes are
not required for readiness. Cloudflare unknown-API JSON 404 behavior remains.

## Safeguards

- No price, high-alch, provenance or history value change.
- No new browser-side or request-triggered upstream fetch.
- No weakening of import size/schema/duplicate-key validation.
- No deletion of writer mappings used by scheduled/manual maintainer tooling.
- No server framework, database or auth addition.
- No user-visible “fresh/current” claim after removing status metadata.
- No removal if an external consumer remains unknown.

## Non-goals

- No scheduled writer reactivation.
- No market source change or live upstream request.
- No deletion of PriceSet import/export.
- No price snapshot refresh.
- No UI redesign beyond removing compatibility-only status/sync copy.
- No archived `market.js` cleanup; archived runtime scope is separate.

## Implementation sequence

1. Complete the consumer checkpoint.
2. Add current static-boundary tests before deleting endpoint tests.
3. Remove Vite middleware and interactive browser calls.
4. Prune server core, schemas, types and architecture entrypoints by reachability.
5. Remove compatibility-only mocked Playwright flows while retaining static,
   import, manual override and history coverage.
6. Update live-integration, architecture, operations, product inventory and
   testing owners.
7. Run startup, static asset, artifact and unknown-API checks.

## Acceptance checks

```sh
rg -n "/api/market/(status|sync)|fetchMarketStatus|syncMarketPrices|marketApiPlugin" src scripts vite.config.ts
npm run test -- src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/data-economy.test.ts src/tests/vite-config.test.ts src/tests/cloudflare-worker.test.ts
npm run test:startup:dev
npm run architecture:check
npm run typecheck
npm run build
npm run deploy:verify-artifact
npm run docs:check
git diff --check
```

The final `rg` hits must be limited to historical evidence or explicit negative
assertions. Run the affected Economy Playwright path when browser prerequisites
are available.

## Done when

- no current application, dev server or preview server exposes interactive
  market sync/status without a consumer;
- static price loading/import/manual/history workflows are unchanged;
- architecture has no stale market middleware entrypoint;
- tests describe the accepted static product boundary;
- unknown API routes remain sanitized; and
- scheduled automation remains disabled until its separate trigger.

## Open questions

- Does the known tester or a maintainer script call the Vite-only market
  endpoints?
- Which mocked browser scenario should become a static-snapshot or imported
  PriceSet scenario rather than being deleted?

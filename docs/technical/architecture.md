# Architecture

- Status: implemented
- Date: 2026-07-27
- Owner: technical architecture
- Last verified: 2026-07-27
- Evidence: verified
- Contract: living

This document owns the current runtime boundaries, dependency policy and source
map. It deliberately contains no module totals, artifact measurements or test
pass counts. Run `npm run architecture:check` for the current source graph and
follow [testing.md](testing.md) for validation commands. Dated architectural
measurements belong in [project evidence](../project/audit-evidence.md).

## System context and entrypoints

Index Sim is a static-first Vite and React browser application with narrow
same-origin integration handlers. The production deployment unit is a
Cloudflare Worker with Static Assets; simulation state and calculations remain
client-side.

- `index.html` is the production browser entrypoint. It renders a non-empty
  pre-React startup shell, loads the DOM-only startup guard and then imports
  `src/app/main.tsx`.
- `src/app/main.tsx` mounts the root error boundary and lazy application
  composition root.
- `src/app/calculation-worker.ts` is constructed by URL as the calculation
  Worker entrypoint.
- `src/server/cloudflare-worker.ts` is the Cloudflare runtime entrypoint for
  static assets and same-origin API routing.
- The Vite Hiscores and market middleware modules are local development
  entrypoints.
- `legacy/index.html` is the archived script-order reference application. It
  is not a supported production entrypoint.

Entrypoints that are invoked by HTML, Vite, Wrangler, Worker URL construction
or repository tooling are explicitly classified in
`scripts/check-architecture.ts`. A source module without an importer must be
listed there for a concrete reason or the architecture check fails.

## Source ownership

| Area              | Owns                                                                                                      | Must not own                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/app`         | React composition, browser state, controllers, view models, presentation and user-triggered orchestration | Server implementation or a second domain truth                |
| `src/domain`      | Pure calculation and planner rules, schemas and deterministic results                                     | React, browser globals, adapters, data loading or server code |
| `src/data`        | Committed generated snapshot types and data access contracts                                              | UI state, browser effects or provider calls                   |
| `src/adapters`    | Translation between browser/domain contracts and generated, storage, market or Hiscores boundaries        | React composition or server routing                           |
| `src/server`      | Framework-neutral same-origin handlers, provider guards and the Cloudflare adapter                        | App presentation or browser adapter ownership                 |
| `scripts`         | Repository generation, audits, measurements, deployment validation and local checks                       | Production browser state                                      |
| Root legacy files | Archived calculation/UI reference and golden-fixture inputs                                               | Current production ownership                                  |

The main app composition root may coordinate cross-feature transactions, global
status and Undo, persistence effects and lazy panes. Feature components receive
typed values and intent callbacks; they do not read storage, call providers or
start calculations directly. Controllers own bounded browser lifecycles, while
domain modules remain free of browser and framework concerns.

Current feature contracts and closed implementation evidence are catalogued in
[the technical specification catalog](specifications.md). Historical extraction
diaries in those specifications do not override the ownership table above.

## Dependency policy

`npm run architecture:check` builds the TypeScript source import graph and
enforces these directions:

- app code cannot import server code;
- adapters cannot import app or server code;
- data cannot import app, adapters or server code;
- domain cannot import app, adapters, data or server code; and
- server cannot import app or browser adapters.

The same check rejects source cycles, unclassified orphan modules, stale
external-entrypoint declarations and archived runtime code reachable from the
production client entrypoint. The accepted exception set is explicit in the
checker and is currently intended to remain empty. Counts printed by the command
are execution evidence, not a prose contract.

## Browser bootstrap and recovery

The startup path has two failure boundaries:

1. The DOM-only startup guard owns sanitized pre-React failure presentation.
2. The React error boundary owns post-mount render and lifecycle recovery.

Runtime bootstrap loads the committed generated snapshot asynchronously,
validates revision and compatibility context, resolves the active PriceSet and
only then enables persistence. A tab-scoped safe-session path can substitute
isolated in-memory storage before persisted loaders run. It never clears or
overwrites the original browser storage.

Optional panes are requested on first activation and retained after loading.
Pane-local boundaries keep an optional chunk failure below the shared shell.
The queryless route selects Compare; the browser-context owner handles
allowlisted pane URLs, navigation history and ready document titles.

## Calculation boundary

The UI maps validated state into domain requests. The composed
`FullSimulationResult` is the primary numeric truth for combat, Trip, XP and
economy presentation. Compare, Duel, Planner and Risk may have feature-specific
lifecycles, but must not create competing combat or Trip formula owners.

Long or cancellable calculations use the calculation Worker through a typed
one-shot task protocol. Controllers own request identity, freshness, previous
result retention, cancellation and fixed error copy. Worker lifecycle changes
remain governed by
[the retention contract](calculation-worker-retention-spec.md).

## Persistence and transfer boundaries

Browser persistence is versioned and schema-validated. `src/app/state`,
`src/app/controllers` and storage adapters divide responsibilities as
follows:

- state modules define canonical values, migration and compatibility policy;
- controllers own latest-request sequencing, review candidates and guarded
  transactions;
- storage adapters provide bounded browser access without feature policy; and
- `App` applies cross-feature mutations and the single global Undo outcome.

Setup, saved-setup, PriceSet and Workspace files are parsed by content and
version, reviewed before mutation and applied through caller-owned boundaries.
Cross-tab freshness uses exact raw baselines and blocks only conflicted areas.
Workspace restore preflights selected areas, performs ordered persistence with
rollback and keeps session-only recovery separate from durable writes.

No user accounts, auth service or general application database exist. The only
accepted server-managed state is the dedicated aggregate Hiscores
provider-budget Durable Object described by D-097; enforcement is committed
disabled and activation requires the recorded decision boundary.

## Generated game data

The root app consumes `src/data/generated/game-data.json` with its agreeing
source pin and generated schemas through `src/adapters/generated`. The manual
`npm run data:generate` workflow parses a pinned LostCity content checkout,
requires an explicit game revision and writes the snapshot, source pin and
revision-impact report as one reviewed change.

Generated JSON and source-pin files are the machine-readable current truth for
revision identity and catalog content. Markdown does not duplicate mutable
snapshot totals. The generator-owned report is routed through
[generated evidence](../project/generated-evidence.md). Raw upstream content
remains gitignored and is not a production dependency.

The legacy-derived runtime snapshot and archived browser sources remain
regression, fixture and rollback evidence. Production bootstrap must not import
them.

## Prices and market data

Committed `prices.json`, `price-provenance.json`, `alch.json` and
`price-history.json` form the static market inputs. Generated game data owns
high-alch values; scheduled static prices take precedence for supported market
items, with generated item fallbacks used only where allowed.

The local scheduled-price writer validates candidate files and provenance
before deterministic writes. Automatic GitHub Actions execution is disabled
under D-099; the retained workflow template lives outside the active workflow
directory. The production UI therefore describes the committed snapshot and
does not issue a user-triggered upstream market refresh.

Operational commands and freshness claim boundaries belong in
[operations](../operations/README.md), not this architecture owner.

## Same-origin integrations and server boundary

The browser uses typed same-origin Hiscores and compatibility market adapters.
Framework-neutral handlers under `src/server` own validation, timeouts,
response limits, rate limiting and sanitized errors. Vite middleware adapts the
same handlers for local development; the Cloudflare Worker adapts them for
deployment.

The Hiscores path uses the accepted provider mapping and does not persist player
or query identity on the server. The optional aggregate provider budget stores
only window/config state in its dedicated Durable Object. Market values in the
production UI remain committed static inputs even though compatibility handlers
and local writer tooling are retained.

No stateful simulation backend, general API framework, account system or
server-managed market history is part of the accepted design. Adding one
requires an explicit decision in [decisions.md](../project/decisions.md).

## Deployment shape

The selected production target is a root-path Cloudflare Worker plus Static
Assets. `wrangler.jsonc`, `public/_headers` and
`scripts/verify-public-deployment.ts` own the repository configuration and
artifact/HTTPS validation boundary.

The release runner executes type, architecture, documentation, test, build,
artifact, lint, format, dependency-audit and diff checks before upload. Account
connection, preview/production smoke evidence and any custom domain remain
adopter operations under D-067. No active repository GitHub Actions workflow
owns deployment.

## Archived legacy reference

The archived runtime loads root JavaScript files in script order:
`gamedata.js`, `engine.js`, `trip.js`, `equipment.js`, `market.js`,
`planner-core.js`, `planner.jsx` and `views.jsx`. Those files use
`window.*` contracts and remain sensitive to order.

They may be read for golden fixtures, parity classification and rollback
evidence. They are not current product truth, must not become client-reachable
from `src/app/main.tsx` and must not dictate rewrite module boundaries.

## Risks and decision boundaries

- Browser-local state can be unavailable, invalid, non-durable or changed by
  another tab. Recovery, attention, cross-tab and Workspace contracts mitigate
  this without claiming server sync.
- Generated content and market snapshots can become stale. Source pins,
  provenance, readiness checks and explicit disabled-automation copy make the
  boundary visible; they do not create automatic freshness.
- Live-provider and aggregate-budget behavior needs deployed evidence before a
  live availability or abuse-resistance claim.
- Browser engines, branded Safari, physical devices and assistive technology
  have separate evidence boundaries in [testing](testing.md).
- Large modules are retained when a split has no demonstrated maintenance
  trigger. Retention specifications own the reopen criteria.
- Deployment account connection, observability and public-domain policy remain
  adopter decisions.

Accepted decisions and unresolved boundaries are recorded in
[decisions.md](../project/decisions.md). Current implementation work belongs in
[the backlog](../project/backlog.md). Dated architecture findings remain in
[audit evidence](../project/audit-evidence.md); neither is a substitute for this
living owner.

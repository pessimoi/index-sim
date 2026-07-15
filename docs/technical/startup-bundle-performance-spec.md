# Startup and bundle performance specification

Status: implemented in Goal 3/3, 2026-07-13.

## Problem

The production build before this goal emitted one 1,562,480-byte minified
entry JavaScript asset (245,210 bytes gzip). The committed generated game-data
snapshot alone is 1,069,141 source bytes and entered that asset through a static
import in `src/adapters/generated/index.ts`.

The application already models bootstrap as asynchronous and renders a bounded
loading state before `SimulationContext` becomes available. Keeping the full
snapshot in the parser-critical entry therefore delays the first useful paint
without simplifying product state. Existing CPU performance tests cover
calculation work, not network transfer, entry parsing or cold/warm browser
startup.

## Goals

- Measure the production artifact and paired cold/warm browser startup through a
  repository-owned command.
- Keep a deterministic entry-JavaScript budget in the release gate.
- Move the generated runtime snapshot behind the existing asynchronous bootstrap
  boundary when the build proves it is a separate chunk.
- Preserve the current loading, fatal-error, persistence, migration, price and
  calculation behavior.
- Record what improves and what does not: staging the snapshot can improve entry
  parse/paint, but it does not reduce the total game-data bytes needed before the
  simulator becomes ready.

## Non-goals

- No calculation, generated-data, PriceSet, storage or setup schema change.
- No feature-pane lazy loading in this goal.
- No service worker, offline cache, CDN, prefetch policy or new deployment
  runtime.
- No hard wall-clock merge budget from one workstation. Browser timings are
  evidence and trend inputs; deterministic artifact bytes own the gate.
- No suppression of Vite's large deferred-chunk advisory.

## Measurement contract

`npm run startup:measure` performs a production TypeScript/Vite build, starts a
repository-local preview server and launches the installed Playwright Chromium.
It runs five paired samples by default:

1. A cold navigation in a fresh browser context with an empty HTTP cache.
2. A warm reload in the same context so immutable hashed assets may be reused.
3. Both samples wait for `[data-app-startup-state="ready"]`, which is emitted
   only after generated runtime context and the initial workbench are ready.
4. Each sample reports app-ready, DOMContentLoaded, load and first-contentful-
   paint times plus request, transfer, decoded and JavaScript resource bytes.
5. The report includes every sample and the median; it writes no repository
   file and makes no upstream/provider request.

The command accepts `--runs <1-20>`, `--port <1024-65535>` and `--skip-build`.
Results vary with machine load and browser version. Compare before/after runs on
the same machine; do not promote one local median into a universal latency SLA.

## Deterministic release budget

The deployment artifact verifier owns the direct assets referenced by
`dist/index.html`. It must report:

- direct entry JavaScript raw bytes
- direct entry JavaScript gzip bytes
- total JavaScript chunk count

The original D-094 post-split limits were 725,000 raw / 210,000 gzip bytes.
After the accepted feature and ownership work grew the direct entry to 721,534
raw / 209,167 gzip bytes without returning the generated snapshot to it, D-098
rebaselines the maintained release limits to:

- entry JavaScript: at most 800,000 raw bytes
- entry JavaScript: at most 230,000 gzip bytes

Both limits leave maintainable headroom over the measured implementation while
remaining far below the 1,562,480-byte pre-split entry and therefore preventing
the generated snapshot from silently returning to the entry. D-098 changes no
chunk boundary or startup behavior. The gate does not cap total artifact bytes
because the accepted current-revision snapshot is required runtime truth.

## Accepted split boundary

The app keeps synchronous imports of the small generated price helpers from
`src/adapters/generated/price-fallback.ts`.
`src/app/controllers/use-runtime-bootstrap.ts` dynamically imports the
`src/adapters/generated` runtime module and then calls its existing
`loadGeneratedRuntimeContext()` API. The DOM-free resolver owns the later
compatibility and price composition; `App.tsx` applies one typed result.

This boundary is safe because:

- `App` exposes loading and fatal-error states for the controller promise
- no control or calculation renders before `context` exists
- generated JSON validation remains inside the adapter
- scheduled/selected/manual price composition still starts after game data
- dynamic-import failure flows through the existing sanitized fatal error
- Node/tests retain the synchronous `createGeneratedRuntimeContext()` helper

The generated snapshot must appear in a deferred JavaScript chunk after build,
while `index.html` references only the bounded entry JavaScript and stylesheet.

## Compatibility contract

The change must preserve:

- all visible loading, ready and failure copy
- all Playwright roles/selectors and keyboard behavior
- generated runtime validation and source tag
- setup/Duel compatibility recovery and legacy migration timing
- selected, scheduled, bundled and manual price precedence
- calculation requests, results, golden fixtures and worker behavior
- Cloudflare root-path asset and security-header rules

## Acceptance checks

```sh
npm run startup:measure
npm run test -- src/tests/generated-runtime-adapter.test.ts src/tests/deployment-readiness.test.ts src/tests/ui-performance.test.ts
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

The before/after report belongs in the implementation evidence below and in
`docs/technical/testing.md`. If entry bytes do not improve materially or browser
behavior regresses, revert the split and retain only the measurement tooling.

## Open questions

- Whether later feature panes should load on demand remains open until their
  state/focus/accessibility boundaries are independently specified.
- Whether the deferred snapshot should become a standalone immutable JSON fetch
  remains open; doing so would change validation, cache and deployment semantics
  beyond this goal.

## Implementation evidence

Five paired runs on Playwright Chromium 149.0.7827.55 produced these medians on
the same workstation:

| Metric                   | Before split | After split |
| ------------------------ | -----------: | ----------: |
| Cold app ready           |       240 ms |      241 ms |
| Cold FCP                 |       112 ms |       80 ms |
| Cold DOMContentLoaded    |        62 ms |       54 ms |
| Warm app ready           |       167 ms |      168 ms |
| Entry JavaScript raw     |  1,562,480 B |   683,659 B |
| Entry JavaScript gzip    |    245,210 B |   197,123 B |
| Cold JavaScript transfer |    245,510 B |   245,662 B |

The outcome supports staged parsing and earlier paint, not a total-download
claim. The deferred generated-runtime chunk is 880,362 raw / 47,939 gzip bytes.
The final artifact contains 10 files, two direct index assets and three
JavaScript chunks; its total is 1,939,237 bytes and SHA-256 is
`1f86ddc20e24331e9f380b0b2e957a0dcb1e47d52612094d79eecbbf2c4fbbda`.

Focused generated-runtime, deployment-readiness and CPU performance suites pass
23/23. The complete production-preview Chromium gate passes 76/76. The
architecture graph remains cycle-free with 68 source modules, 55
client-reachable modules and zero exceptions. Final `npm run verify` passes 624
unit tests, 19 explicit legacy goldens, typecheck, architecture, build/artifact
budgets, lint, format and diff gates.

The later D-093 ownership extraction moves the unchanged split into
`src/app/controllers`. Its artifact keeps the generated chunk at 880,362 raw
bytes and the direct entry at 685,731 raw / 197,749 gzip bytes, still below the
accepted budgets. It does not replace the paired workstation timings above.

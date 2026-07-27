# Historical testing current-state snapshot — 2026-07

- Status: historical
- Date: 2026-07-27
- Owner: technical testing evidence
- Evidence: verified
- Contract: closed

This page preserves the former current-state section removed from
[testing.md](testing.md). Its measurements and pass totals are dated historical
evidence; current commands remain in the testing owner and current results in
[the evidence index](../project/testing-evidence.md).

## Current state

The current 2026-07-21 combined gate evidence covers 118 Vitest files / 1,136
tests, 19 explicit goldens, typecheck, lint, formatting, the 178-source-module/
164-client-reachable-module/eight-external-entrypoint zero-cycle architecture
check and build/artifact budgets. The clean cumulative `npm run verify` rerun is
green. The current 29-file artifact has 22 JavaScript chunks, 2,442,848 total
bytes and SHA-256
`bfd472aaa26e64a913d3839ac6576ada69d3b303712b2171bf3a893c89fa93d3`;
its direct entry is 277,198 raw / 83,815 gzip bytes and remains inside the D-098
budgets. PF-06's named Workbench history transaction passes 1/1 in Chromium,
its focused CB-09 extension passes 3/3 and the complete release manifest passes
36/36 across Playwright Firefox, desktop WebKit and iPhone 13-emulated WebKit.

The explicitly reviewed Darwin baseline now contains 26 scenarios and 37
fixture-only snapshots. The six-goal release-readiness review changed exactly
10 Loot, Economy, Planner-mobile and Settings-owned PNGs after inspecting every
candidate and later capture. It also narrowed the Loot sticky-header selector
after the first review exposed a nested-row occlusion. Two complete read-only
runs after the scoped update pass 26/26 and 26/26 without clipping, widening,
lost controls, unexplained numeric drift or private fixture content.
The verification subprocess skips dependency audit under its network-disabled
policy; the immediately following escalated `npm audit` reports zero
vulnerabilities.

The 2026-07-22 release-polish review supersedes the remaining stale pre-PF
images. The 26 first-mismatch pairs were inspected before the initial candidate
write; that run then exposed all 37 tracked current-vs-HEAD pairs for inspection
before final acceptance. The review includes the accepted PF-01 through PF-06
presentation changes and RP-01 through RP-06, rather than attributing the full
set only to RP-03/RP-05.
One initial nested Loot-mobile candidate was rejected because the outer sticky
row name obscured child identities. The detail stacking/opaque-background fix
restored those labels before the scoped Loot update. Two complete read-only
runs after the final write pass 26/26 and 26/26.

Detailed dated implementation, release and superseded failure snapshots live in [the testing evidence log](../project/testing-evidence.md); they are evidence, not current command truth.

The functional Playwright, composed view-model and testing-document ownership
split is specified in
[feature-test-suite-split-spec.md](feature-test-suite-split-spec.md). New tests
and guidance go directly to the nearest feature/topic owner; do not recreate the
former catch-all files.

The root app path uses the Vite/React rewrite and has npm scripts for TypeScript, Vite, Vitest, Playwright, ESLint and Prettier. The archived legacy app in `legacy/index.html` still transforms JSX in the browser by Babel Standalone and has no local JSX typecheck/build step.

For interactive local Vitest iteration only, use:

```sh
npm run test:watch
```

Watch mode is a development convenience, not a release or handoff gate.

The D-083 Hit distribution comparison adds focused domain/view-model coverage
for separate miss and accurate-zero outcomes, sustained-roll mixtures,
independent whole-special convolution, probability totals, expected values,
shared normal/special axes, cumulative thresholds and full-target-HP KO
context. Browser coverage owns the vertical bars, normal-only and selected-spec
states, accessible bucket names/exact table and chart-local responsive overflow.
Rates-only Dense/Duel view-model paths explicitly omit chart presentation data.
The calculation-task structured-clone integration case combines Dense, Planner,
Duel and Risk in one test and therefore uses a 15-second runner timeout; this is
test scheduling headroom, not a product performance budget. The separate
`ui-performance.test.ts` suite continues to own the accepted performance
boundaries.

Browser startup and artifact entry size are separate from those CPU tests. Run
the local paired measurement with:

```sh
npm run startup:measure
```

It reports raw samples and medians for cold fresh-context navigation and warm
same-context reload. Timing values are workstation evidence, not merge budgets;
the deterministic raw/gzip entry limits are enforced by artifact validation.

For the development-server startup boundary, run:

```sh
npm run test:startup:dev
```

This check starts a fresh strict-port Vite process, forces bounded dependency
re-optimization, attaches browser diagnostics before first navigation, waits
for the canonical `ready` marker, exercises a controlled pre-React failure and
proves direct JSON/HEAD versus transformed raw-module scheduled-price routing.
It closes its server and browser and calls no live provider. Installed
Playwright Chromium and localhost binding are environment prerequisites, so the
command remains separate from browser-independent `npm run verify`.

Use [rewrite-parity-report.md](rewrite-parity-report.md) to interpret which user-visible calculation areas are currently legacy-parity certified, partially covered or not ported.

Accepted parity policy: legacy results are regression evidence, not the final truth source. Keep golden tests to catch accidental changes, but allow documented intentional deltas when the current accepted LostCityRS/Content revision or another accepted source shows the legacy app should be replaced.

Game revision bumps are development changes, not scheduled data refreshes. The current generator exposes `npm run data:generate` for repository-local source/output-path validation, raw LostCity config/RuneScript parsing, schema-valid output writing and a committed revision-impact report. Raw production generation requires explicit bounded `--game-revision`; the current reviewed value is `274`. It writes one matching revision/source/commit/generated-at context to `src/data/generated/game-data.json` and `source-pin.json`, validates their agreement and records the input in the impact report command. Git history and PR diffs provide the review baseline. D-059 makes that committed Revision 274 snapshot the root runtime through `src/adapters/generated`, with scheduled static prices first and generated item fallbacks second. The legacy-derived snapshots remain regression/reference inputs and may omit context; they are not the root bootstrap. Runtime readiness blocks missing/invalid revision context, missing expected identities, required simulator fields, monster combat/loot rows and PriceSet coverage; the report script also blocks committed snapshot/source-pin disagreement. Accepted source value changes belong to revision-impact evidence. The current snapshot is ready with zero blockers, the representative suite passes 11/11 cases under D-055/D-057/D-071/D-072, and the refreshed 189-evaluation informational scan finds 38 advisory outliers with the configured first 25 shown. Snapshot validation rejects raw upstream dump shapes, historical snapshot archives and unused source-only content. The raw parser emits NPC size for 63/63 monsters, numeric Attack/Strength/Defence/Ranged/Magic requirements for 94 runtime items and 25 typed conditional loot rows. Planner/setup/quick-action consumers use generated requirements first and D-051 fallback only for legacy/missing rows. Conditional quest/clue rows stay visible but contribute no value, inventory, alch or prayer effect until a separately accepted exact player-state contract can activate them. Do not hand-edit generated source truth, infer quest completion state, activate conditional loot, remove the requirement fallback or refresh accepted calculation baselines without the corresponding evidence and decision.

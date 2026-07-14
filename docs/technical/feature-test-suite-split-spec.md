# Feature test-suite split specification

Status: implemented, 2026-07-14 for ARCH-2026-05.

## Purpose

This specification closes the actionable test-code part of ARCH-2026-05 by
splitting the functional Playwright and composed UI view-model concentrations
along existing feature seams. It also separates the short current testing guide,
topic references and dated evidence log. The implementation preserves exact
test titles, bodies, fixtures, application behavior and authoritative gate
totals.

This is test ownership work. It does not authorize production refactoring,
expectation updates, fixture recapture, visual-baseline changes or rewriting the
historical evidence log merely to reduce line counts.

## Starting evidence

Immediately before this split:

- `src/tests/e2e/scaffold.spec.ts` had grown to 5,046 lines and 75 functional
  cases after the current Economy history-age regression was added;
- the three already separate shareable-setup cases brought the default
  Playwright gate to 78 cases;
- the separate visual owner contained 20 tests and 31 reviewed Darwin
  snapshots;
- `src/tests/ui-view-model.test.ts` was 3,562 lines / 90 cases after six direct
  MonsterCard cases moved to their feature owner and one composed assertion
  remained; and
- `docs/technical/testing.md` mixed the current gate/commands and 1,892 lines of
  dated or superseded evidence; and
- full verification passed 71 Vitest files / 770 tests plus 19 goldens, while
  the latest complete functional Chromium gate passed 78/78.

The problem was review and navigation concentration, not missing behavioral
coverage. The first pass therefore moves tests without changing their
assertions or widening product scope.

## Accepted contracts

The split must preserve:

- every functional and view-model test title present at split time;
- the current Economy age regression added by the code audit;
- generated game-data, price, legacy-golden and rewrite fixture ownership;
- storage keys, versions, test payloads and deterministic timestamps;
- numeric labels, tolerances and exact browser-rendered snapshots;
- Playwright `testDir`, visual-test exclusion, Chromium project, 60-second test
  timeout, `fullyParallel` policy and production build/preview web server;
- one fresh browser context per functional test and no file-order dependency;
- the 78-case default functional gate, separate 20-case visual gate, 90-case
  composed view-model boundary and direct MonsterCard coverage; and
- all calculation, persistence, UI copy, DOM, CSS, artifact and deployment
  behavior.

Moving a test does not authorize renaming it, weakening an assertion, changing a
fixture or accepting a new numeric value.

## Functional Playwright ownership

The former scaffold is replaced by one shared fixture/helper leaf and eight
feature specs. The pre-existing shareable-setup spec remains direct.

| Owner                               | Lines | Cases | Responsibility                                                                                         |
| ----------------------------------- | ----: | ----: | ------------------------------------------------------------------------------------------------------ |
| `e2e/scaffold-fixture.ts`           |   347 |     0 | Generated runtime/price fixture, metric snapshots, storage envelope and genuinely shared UI assertions |
| `e2e/shell-accessibility.spec.ts`   | 1,136 |    19 | Root shell, tabs, Stats/MonsterCard, keyboard, responsive containment and searchable controls          |
| `e2e/persistence-migration.spec.ts` |   925 |    13 | Legacy review, local-state recovery, setup/PriceSet import-export and failure recovery                 |
| `e2e/cannon-trip-loot.spec.ts`      |   830 |    15 | Cannon, Trip, Loot, conditional rows and their browser numeric paths                                   |
| `e2e/compare-numerics.spec.ts`      |   599 |     8 | Dense behavior, freshness, markers and fixture/release numeric snapshots                               |
| `e2e/integrations-economy.spec.ts`  |   490 |     6 | Hiscores, scheduled market boundary, manual prices and Economy history                                 |
| `e2e/loadout.spec.ts`               |   477 |     9 | Combat-style state, equipment, quick actions, optimizer, custom setups and specials                    |
| `e2e/planner-duel.spec.ts`          |   304 |     4 | Planner, Duel snapshots/matrix and main-thread Worker evidence                                         |
| `e2e/risk.spec.ts`                  |    59 |     1 | Explicit modeled Risk run, invalidation and cancellation                                               |
| `e2e/shareable-setup.spec.ts`       |   180 |     3 | Existing setup-link review/load/dismiss boundary                                                       |

The default Playwright collector therefore owns 78 tests in nine spec files.
`scaffold-fixture.ts` is not a spec and registers no test. The separate
`visual-regression.visual.spec.ts` and its configuration are unchanged.

### Shared fixture rule

The fixture leaf may contain only values or helpers used across multiple
functional features, including the source-backed generated context, numeric
snapshot helpers, searchable-control actions and containment assertions.
Feature-specific flows and expectations remain in their spec.

New tests go directly to the closest feature file. Recreating a broad
`scaffold.spec.ts`, exporting feature-only helpers from the fixture or relying
on alphabetical file execution is not accepted.

## Composed view-model ownership

The former `ui-view-model.test.ts` is replaced by one 224-line shared fixture
leaf and eight direct integration suites:

| Owner                                   | Lines | Cases | Responsibility                                                                |
| --------------------------------------- | ----: | ----: | ----------------------------------------------------------------------------- |
| `ui-view-model-fixture.ts`              |   224 |     0 | Legacy/generated context, golden tolerance and shared form/detail helpers     |
| `loadout-view-model.test.ts`            |   637 |    21 | Options, quick actions, optimizer, two-handed rules and setup requirements    |
| `stats-view-model.test.ts`              |   803 |    17 | Specials, distributions, combat-roll detail, XP and source breakdown          |
| `trip-simulation-view-model.test.ts`    |   472 |    13 | Trip input mapping, food/recoil/potions/prayer/cannon and summary composition |
| `loot-simulation-view-model.test.ts`    |   536 |    11 | Loot rows, composition/actions, conditional rows, history and optimization    |
| `simulation-view-model.test.ts`         |   229 |     9 | Request mapping, composed result, MonsterCard bridge and legacy summaries     |
| `compare-view-model.test.ts`            |   269 |     8 | Dense rows, markers, filtering, sorting, scaling and visibility               |
| `active-assumptions-view-model.test.ts` |   336 |     7 | Price/loot/cannon assumptions, priority and targeted reset                    |
| `duel-view-model.test.ts`               |   212 |     3 | Current-target Duel rows, setup diff and all-monster matrix                   |

These eight files contain 89 cases. The original generic number-formatting case
now lives with the two direct formatting regressions in `formatting.test.ts`, so
all 90 split-time titles remain present. The six direct MonsterCard cases and
one composed simulation assertion retain the previous ownership contract.

The shared fixture is test-only infrastructure, not a production compatibility
barrel. A feature suite imports only the contracts it exercises. New direct
view-model behavior belongs in the corresponding feature owner; a genuinely
cross-feature composition assertion belongs in `simulation-view-model.test.ts`.

## Title and collection proof

Static title comparison records:

- all 74 tests in the committed scaffold baseline remain present;
- the one current uncommitted Economy history-age case is the only addition,
  producing 75 migrated scaffold cases;
- the three existing shareable-setup cases produce the unchanged 78-case
  default functional collection; and
- the exact 90-case post-MonsterCard view-model title set is unchanged after
  accounting for the formatting owner move.

`playwright test --list` reports 78 tests in nine files. Duplicate titles are
not introduced within a feature owner.

## Test-only cleanup

The unused `buildPlannerPlanForDefinition()` helper and its two imports are
removed from `src/tests/helpers/domain-planner.ts`. Repository search found no
consumer. This does not change a test case, Planner calculation or production
API.

## Testing documentation ownership

The former mixed testing document is split without rewriting its evidence:

| Owner                                               | Lines | Responsibility                                                                 |
| --------------------------------------------------- | ----: | ------------------------------------------------------------------------------ |
| `docs/technical/testing.md`                         |   178 | Current gate, authoritative commands, change-type minimums and routing         |
| `docs/technical/testing/domain-and-integrations.md` |   385 | Domain, golden, Planner, performance and same-origin integration guidance      |
| `docs/technical/testing/runtime-data-deployment.md` |   620 | Data generation, runtime readiness, persistence health and deployment guidance |
| `docs/technical/testing/ui-state-and-browser.md`    |   282 | UI/state/view-model inventory and functional/visual browser guidance           |
| `docs/project/testing-evidence.md`                  |   505 | Dated implementation/release results and superseded failure matrices           |

The short main guide remains the source of truth for current commands. Topic
guides are living references reached from it. The project evidence log is a
snapshot owner and must not override a newer current-state result.

## Non-goals

- No production TypeScript, React, domain, adapter or server change.
- No test title/body/assertion rewrite or expectation relaxation.
- No new fixture, baseline, test retry or timeout.
- No change from `fullyParallel` to ordered/serial execution.
- No merge of functional and visual Playwright configuration.
- No line-count guard; file size is evidence, not behavior.
- No semantic rewrite of historical testing evidence. Moving dated sections to
  `docs/project/testing-evidence.md` must preserve their historical status and
  must not promote them over the current summary.

## Guard policy

The executable protection is behavioral:

- typecheck catches invalid fixture exports/imports;
- focused view-model execution proves all moved suites collect and run;
- `playwright test --list` owns the 78-case/9-file default collection;
- full single-worker Chromium execution detects hidden file-order or shared
  state assumptions;
- numeric audit and goldens protect calculation/fixture values;
- full verification owns all Vitest collection, architecture, production
  artifact, lint, formatting and diff checks; and
- visual comparison remains required only when markup, styling, rendering or a
  visual fixture changes.

A brittle assertion for exact lines per file is intentionally omitted. If a
feature spec later grows materially, its changed feature should extract the
next local seam while preserving its fixture and titles.

## Implementation sequence

1. Characterize both original title sets and current gate totals.
2. Extract shared test-only fixture leaves without registering tests.
3. Move view-model cases by direct feature owner.
4. Move functional cases by browser workflow owner; keep Playwright config
   unchanged.
5. Prove title equality, collection totals and no production diff.
6. Run focused view-model, complete Chromium and repository gates.
7. Split current commands, topic guidance and dated evidence into explicit
   documentation owners.
8. Update architecture, testing, backlog and audit navigation.

## Acceptance checks

```sh
npm run typecheck
npm run test -- src/tests/formatting.test.ts src/tests/monster-card-view-model.test.ts src/tests/simulation-view-model.test.ts src/tests/loadout-view-model.test.ts src/tests/active-assumptions-view-model.test.ts src/tests/trip-simulation-view-model.test.ts src/tests/stats-view-model.test.ts src/tests/duel-view-model.test.ts src/tests/loot-simulation-view-model.test.ts src/tests/compare-view-model.test.ts
npx playwright test --list
npm run test:e2e -- --workers=1
npm run numeric:audit
npm run test:golden
npm run verify
git diff --check
```

No visual run is required for this test-file-only move. The existing read-only
20/20 visual result remains applicable because no application source, fixture,
snapshot, markup or style changes in this split.

## Implementation evidence

- The old 5,046- and 3,562-line owners are removed. The largest new functional
  spec is 1,136 lines; the largest new view-model suite is 803 lines.
- Static comparison preserves 75/75 scaffold-era current titles and 90/90
  split-time view-model titles.
- The focused view-model/formatting/MonsterCard command passes 10 files / 98
  tests. The eight split suites plus formatting owner account for 92 of those;
  the six direct MonsterCard cases retain their preceding owner.
- Typecheck passes, and Playwright collection reports 78 tests / nine files.
- Complete production-preview Chromium passes 78/78 with one worker in 2m 12s,
  proving the new file order does not expose a serial dependency.
- Current commands, three topic guides and dated evidence now have the explicit
  owners and line counts listed above; current-vs-historical precedence is
  unchanged.

- Numeric audit passes 5,958/5,958 with zero mismatches, and all 19 goldens
  pass.
- Full `npm run verify` passes 78 Vitest files / 770 tests plus 19 goldens,
  architecture 121/109 without a cycle or exception, typecheck, build/artifact,
  lint, formatting and diff gates. The current source tree produces a
  10-file/two-asset, 1,974,877-byte artifact with entry JavaScript at 720,422
  raw / 208,739 gzip bytes and SHA-256
  `babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`.
  Other concurrent production-source changes determine those bytes; this split
  itself changes no production-source file.
- The split itself required no new visual run because it changed no markup,
  styling, rendering fixture or snapshot. A later repository-wide CSS cleanup
  reran the same read-only suite 20/20 against all 31 unchanged baselines; that
  result belongs to [the maintainability cleanup audit](../project/maintainability-cleanup.md).

## Open questions

- None. Future growth follows the nearest feature/topic owner and reopens a
  split only from concrete navigation, review or isolation evidence.

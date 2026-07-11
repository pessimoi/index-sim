# Visual regression specification

- Status: implemented repository-locally; remote merge gate not accepted
- Date: 2026-07-10
- Owner: technical testing
- Source: promoted from `docs/project/idea-inbox.md`
- Related current evidence: `docs/technical/testing.md`, `playwright.config.ts`, `src/tests/e2e/scaffold.spec.ts`

## Feature-inventory check

This is test and release evidence, not a separate user-visible feature. It does
not add a feature-inventory row or change an unrelated feature status. The
functional Playwright gate remains the owner of interaction and numeric
behavior; the implemented visual project adds pixel-level regression evidence
without redefining functional parity or legacy CSS as the product truth.

## Implementation evidence

- `playwright.visual.config.ts` matches only `*.visual.spec.ts`, uses Chromium,
  `process.platform` snapshot paths and the production Vite build/preview path.
- `src/tests/e2e/helpers/visual-state.ts` freezes time, seeds bounded fixture
  state, disables live integration calls and waits for app/fonts readiness.
- `src/tests/e2e/visual-regression.visual.spec.ts` implements 19 scenarios over
  root, Compare, loadouts, Stats, Trip, Loot, Economy, Cannon, Planner, Duel and
  Settings, with additional focused Loot detail snapshots.
- Reviewed Darwin baselines live in
  `src/tests/e2e/__screenshots__/darwin/`.
- `npm run test:e2e:visual` compares only; baseline writes require
  `npm run test:e2e:visual:update`.
- The functional `playwright.config.ts` ignores visual test files.

## Goal

Add a deterministic, reviewable Chromium screenshot suite for the current root
Vite rewrite. It should catch accidental layout, overflow, typography, spacing,
visibility and responsive regressions across the main workbench workflows while
keeping baseline updates explicit.

The first implementation is repository-local. It does not choose a CI provider,
hosting target or public release process. Making the command a required remote
merge check remains a separate release/CI decision.

## Non-goals

- Exact pixel parity with archived `views.jsx` or legacy CSS.
- Replacing functional assertions, accessibility checks or numeric snapshots.
- Capturing all 18 golden fixtures in every pane.
- Testing live hiscores, live market responses or time-varying upstream data.
- Adding a general CI workflow, Docker image, deploy job or browser matrix.
- Automatically accepting new screenshots after a failure.

## Test ownership

Add the following implementation-owned surfaces:

- `playwright.visual.config.ts`: visual-only Playwright configuration.
- `src/tests/e2e/visual-regression.visual.spec.ts`: visual scenarios.
- `src/tests/e2e/helpers/visual-state.ts`: deterministic browser-state builders.
- `src/tests/e2e/__screenshots__/<platform>/`: reviewed baseline PNG files.
- `npm run test:e2e:visual`: compare against committed baselines.
- `npm run test:e2e:visual:update`: explicitly regenerate candidate baselines.

The current `playwright.config.ts` and `npm run test:e2e` must continue to run
the functional suite once. Visual test files must be ignored by the functional
config, and the visual config must match only `*.visual.spec.ts` files.

The visual config must use the same production build and `vite preview` server
as the functional gate. It must not reuse an arbitrary running development
server.

## Workbench selector contract

Decision D-080 makes the Player sidebar's `Combat type` control the only
combat-style mutator. The workbench exposes one dynamic setup tab, named
`Melee setup`, `Ranged setup` or `Magic setup` for the selected style; separate
`Melee`, `Ranged` and `Magic` tabs are not part of the current UI contract.

Loadout visual scenarios must select the style through the semantic
`Combat type` button, assert its `aria-pressed` state and assert that the
matching dynamic setup tab is selected before locating the equipment pane.
This selector-contract repair does not authorize baseline writes. Screenshot
changes remain subject to the explicit diff review and update policy below.

### Selector remediation evidence

On 2026-07-12, the focused functional scenario
`updates results when the combat style changes` passed (1/1). A read-only run
of the three desktop loadout visual scenarios then reached screenshot
comparison for melee, ranged and magic without selector timeouts. All three
reported the expected stale-baseline size mismatch (780 px expected pane width
versus 859 px actual pane width). No baseline file was written or accepted in
this remediation step; image review remains a separate goal.

## Baseline environment

Use Playwright's installed Chromium and `scale: "css"`. Baselines are
platform-specific because the current product CSS intentionally falls back to
system fonts and the project has no accepted canonical CI runner. Store the
platform in the snapshot path using `process.platform` so Darwin and Linux
baselines cannot silently overwrite each other.

The normal comparison command must fail when its platform baseline is missing.
Only the explicit update command may create or replace baseline files. If a
future CI runner becomes authoritative, its platform baseline can be reviewed
and committed separately without changing this test contract.

## Determinism rules

Every visual scenario must:

1. Load the production preview from a clean browser context.
2. Freeze browser time to `2026-07-10T12:00:00.000Z` before app bootstrap.
3. Seed only fixed, schema-valid rewrite-owned state needed by that scenario.
4. Mock same-origin integration responses or use the provider-disabled state;
   never call a live upstream.
5. Wait for the generated runtime, scheduled static prices and required pane
   state to be visibly ready.
6. Wait for `document.fonts.ready` before taking a screenshot.
7. Hide carets and disable CSS animations/transitions through Playwright's
   screenshot options.
8. Assert a semantic locator or expected label before each screenshot so a
   blank, loading or wrong-pane image cannot become the baseline.

Use fixed ids, labels and timestamps for seeded custom setups, Duel snapshots,
price history and migration notices. Do not mask core product content. Masking
is allowed only for a value that cannot be made deterministic, and every mask
must have a comment explaining why.

## Viewports

Use these fixed CSS viewports:

| Name    | Width | Height | Purpose                                      |
| ------- | ----: | -----: | -------------------------------------------- |
| desktop |  1440 |   1000 | Primary dense workbench and pane composition |
| tablet  |   768 |   1024 | Dense overflow and workbench containment     |
| mobile  |   390 |    844 | Stacking, controls and right-rail placement  |

Do not scale font size based on viewport. The tests must use the production
responsive CSS at each viewport.

## Required scenario matrix

The first accepted baseline set must cover:

| Scenario       | Required state                                                      | Snapshots                      |
| -------------- | ------------------------------------------------------------------- | ------------------------------ |
| Root shell     | Default generated runtime and scheduled prices                      | desktop full page, mobile page |
| Dense Compare  | Filtered rows, current target and row markers                       | desktop pane, tablet pane      |
| Melee loadout  | Equipment selectors and generated/fallback requirement warning      | desktop active pane            |
| Ranged loadout | Ammo, multi-prayer/boost state and visible manual overrides         | desktop active pane            |
| Magic loadout  | Spell and equipment state                                           | desktop active pane            |
| Stats          | Combat roll detail, XP routing and hit distribution                 | desktop pane                   |
| Trip           | Manual food/prayer/reserve state and grouped summary                | desktop pane, mobile pane      |
| Loot           | Value composition, action impact and one expanded nested drop table | desktop pane, mobile pane      |
| Economy        | Fixed local history, movers and selected item trend                 | desktop pane                   |
| Cannon         | Enabled Dagannoth path with expanded output                         | desktop pane                   |
| Planner        | Deterministically recomputed plan with chart and timeline           | desktop pane, mobile pane      |
| Duel           | Fixed snapshots and built monster matrix                            | desktop pane, mobile pane      |
| Settings       | Price data plus sanitized legacy/local-state review notices         | desktop pane                   |

Use locator screenshots for pane-level cases. Full-page screenshots are limited
to the root desktop/mobile shell because very tall full-page baselines make
small unrelated changes difficult to review.

## Diff policy

Use Playwright `toHaveScreenshot` with:

- `animations: "disabled"`
- `caret: "hide"`
- `scale: "css"`
- `threshold: 0.2`
- `maxDiffPixelRatio: 0.001`

The ratio is a rendering-noise allowance, not permission for structural drift.
Any changed baseline must be reviewed as an image diff. A baseline update must
state which product change caused it. Never run the update command as part of a
normal test, pre-commit hook or automated failure recovery.

## Failure handling

- Missing baseline: fail with instructions to run the explicit update command.
- Visual mismatch: retain actual, expected and diff artifacts in
  `test-results/`; do not commit those transient files.
- Functional setup failure: fail before screenshot comparison through semantic
  assertions.
- Localhost sandbox failure: rerun with the same explicit Playwright localhost
  escalation used by the functional suite.
- Cross-platform mismatch: use the matching platform baseline; do not update a
  different platform's images.

## Security and privacy

- Baselines must contain only repository fixture data.
- Do not include real player names, imported user files, browser profile data,
  secrets, tokens, absolute paths or raw parser diagnostics.
- Use a fresh Playwright context and repository-local output directories.
- Do not take screenshots of OS dialogs, clipboard contents or browser chrome.
- Keep live upstreams disabled/mocked.
- Review PNG changes for accidental local or user data before committing.

There is no auth, account, tenant, payment, database or admin impact.

## Validation

Implementation must run at least:

```sh
npm run test:e2e:visual
npm run test:e2e
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

The functional Playwright count may grow for accompanying behavior checks, but
it must not double because the visual project reruns functional files.

## Rollout

1. Add the isolated config, deterministic helpers and required scenarios.
2. Generate and manually review the current platform baseline set.
3. Keep the suite repository-local and required for visual-impacting changes.
4. Promote it to a remote merge-blocking check only after a CI runner and its
   canonical platform baseline are explicitly accepted.

## Done criteria

- The required scenario matrix has committed platform-specific baselines.
- The comparison command fails on a deliberate visible layout regression and
  passes without baseline changes on a clean rerun.
- The update command is the only documented baseline-write path.
- The existing functional suite still runs each functional test once.
- Dynamic values, fonts, integration states and browser time are stabilized.
- Security/privacy review confirms fixture-only screenshots.
- Testing, backlog and release-evidence docs describe the implemented state
  without claiming full legacy pixel parity or an unaccepted CI gate.

## Open decision boundary

This specification does not accept a CI provider or make the visual suite a
remote merge requirement. That promotion requires a separate explicit decision
because the repository currently has no general CI workflow.

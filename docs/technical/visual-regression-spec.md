# Visual regression specification

- Status: implemented repository-locally; remote merge gate not accepted
- Date: 2026-07-10
- Owner: technical testing
- Source: promoted from `docs/project/idea-inbox.md`
- Related current evidence: `docs/technical/testing.md`, `playwright.config.ts`, `src/tests/e2e/*.spec.ts`

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
- `src/tests/e2e/visual-regression.visual.spec.ts` implements 20 scenarios over
  root, Compare, loadouts, Stats, Trip, Loot, Economy, Cannon, Planner, Duel and
  Settings. D-075 scroll coverage and focused Loot details bring the reviewed
  Darwin set to 31 snapshots.
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

| Name              | Width | Height | Purpose                                      |
| ----------------- | ----: | -----: | -------------------------------------------- |
| desktop           |  1440 |   1000 | Primary dense workbench and pane composition |
| compact landscape |   640 |    360 | D-082 in-app legacy-console containment      |
| tablet            |   768 |   1024 | Dense overflow and workbench containment     |
| mobile            |   390 |    844 | Stacking, controls and right-rail placement  |

Do not scale font size based on viewport. The tests must use the production
responsive CSS at each viewport.

## Required scenario matrix

The first accepted baseline set must cover:

| Scenario       | Required state                                                      | Snapshots                          |
| -------------- | ------------------------------------------------------------------- | ---------------------------------- |
| Root shell     | Default generated runtime and scheduled prices                      | desktop, compact landscape, mobile |
| Dense Compare  | Filtered rows, current target and row markers                       | desktop pane, tablet pane          |
| Melee loadout  | Equipment selectors, requirement warning and damage distribution    | desktop top, details and lower     |
| Ranged loadout | Ammo, multi-prayer/boost state and visible manual overrides         | desktop top and details            |
| Magic loadout  | Spell and equipment state                                           | desktop top and details            |
| Stats          | Combat roll detail, XP routing and Trip/banking summary             | desktop top and roll               |
| Trip           | Manual food/prayer/reserve state and grouped summary                | desktop pane, mobile pane          |
| Loot           | Value composition, action impact and one expanded nested drop table | desktop pane, mobile pane          |
| Economy        | Fixed local history, movers and selected item trend                 | desktop top and trend              |
| Cannon         | Enabled Dagannoth path with expanded output                         | desktop pane                       |
| Planner        | Deterministically recomputed plan with chart and timeline           | desktop pane, mobile pane          |
| Duel           | Fixed snapshots and built monster matrix                            | desktop pane, mobile pane          |
| Settings       | Price data plus sanitized legacy/local-state review notices         | desktop recovery, price, legacy    |

Use locator screenshots for pane-level cases. Full-page screenshots are limited
to the root desktop/mobile shell because very tall full-page baselines make
small unrelated changes difficult to review.

Under D-075, desktop workbench content scrolls inside the semantic
`Active workbench pane`. Desktop pane scenarios must screenshot that scroll
owner's visible viewport after asserting their scenario-specific descendant.
They must not screenshot a taller descendant through the clipped scroll
boundary: Chromium can otherwise return a misleading image with only the
visible top rendered and the remaining descendant bounds filled with the page
background. Tablet/mobile scenarios remain in normal document flow and may
continue to capture their full scenario region. Focused nested Loot tables and
the bounded Compare table remain descendant-locator screenshots.

Long desktop-only surfaces retain coverage through deterministic scroll
positions inside that owner. Each loadout captures its top state and the lower
equipment-bonus area. Stats captures the top summary, combat-roll area and
lower hit-distribution area so the viewport-bound shell does not silently drop
the original scenario matrix's lower-content evidence.

Economy captures the selected trend after its top mover state. Settings
captures the recovery table, the lower Price data area and the separately
bounded legacy-migration notice.

The fixed first-focus skip link must be both translated and visually inert when
unfocused. Its focus-visible state remains part of the functional keyboard
gate; descendant screenshot stitching must not composite the unfocused link
into an unrelated long mobile pane.

## 2026-07-12 diff review decision matrix

Every scenario below was run read-only against the previous Darwin baseline.
Its actual and diff artifacts were visually reviewed before authorizing a
candidate baseline write. `Accept candidate` means the observed change is
explained by an accepted product decision and may enter the explicit update
step; it is not a claim that an unreviewed generated PNG is already accepted.

| Scenario                     | Reviewed change and decision source                                                                                                                                                                   | Candidate disposition |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Root shell desktop           | D-075 makes the three-zone shell viewport-bound at 1440×1000; D-076–D-080 change ownership copy, compact sizing and the dynamic setup tab. No overlap or unintended document scroll was visible.      | Accept candidate      |
| Root shell compact landscape | D-082 keeps the 640×360 three-zone workbench viewport-bound with independent scroll owners instead of a long tablet-flow document.                                                                    | Accept candidate      |
| Root shell mobile            | Normal document flow remains intact; D-076–D-081 add ownership summaries and source-backed Trip/Stats labels. The full fixture-only page remained contained.                                          | Accept candidate      |
| Dense Compare desktop        | D-075 widens the center pane from 780 to 859 px; D-078/D-079 change filter controls. Rows, focus outline and horizontal containment remained legible.                                                 | Accept candidate      |
| Dense Compare tablet         | D-079 popup-combobox styling and compact filter wrapping explain the bounded diff. The table keeps its intended horizontal overflow.                                                                  | Accept candidate      |
| Melee loadout desktop        | D-075 requires the active scroll viewport; D-079/D-080 explain selector and setup ownership changes. Top and lower equipment-detail captures preserve the prior coverage.                             | Accept candidate      |
| Ranged loadout desktop       | Same scroll/selector migration as melee; manual overrides remain visible and the lower detail capture covers equipment bonuses and warnings.                                                          | Accept candidate      |
| Magic loadout desktop        | Same scroll/selector migration as melee; spell state remains visible and the lower detail capture preserves equipment coverage.                                                                       | Accept candidate      |
| Stats desktop                | D-075 changes capture ownership and D-081 adds source-backed incoming-model evidence. Top, combat-roll and lower hit-distribution captures retain the complete required surface.                      | Accept candidate      |
| Trip desktop                 | D-075 changes the visible pane boundary and D-081 adds `Source-backed` incoming-model output without changing the fixed fixture inputs.                                                               | Accept candidate      |
| Trip mobile                  | D-081 adds the incoming-model label in normal flow. The unfocused fixed skip link was made visually inert after the first review exposed a screenshot-stitch artifact; the corrected actual is clean. | Accept candidate      |
| Loot desktop                 | D-075 changes the visible pane boundary; D-077–D-079 explain compact control/table wrapping. Value composition remains readable.                                                                      | Accept candidate      |
| Loot mobile                  | Responsive controls and tables remain contained; fixture-only warnings and nested-drop content are unchanged in ownership.                                                                            | Accept candidate      |
| Economy desktop              | D-075 changes the visible pane boundary and D-078/D-079 replace the stale native-select assumption with the shared combobox. Top movers and the lower trend capture retain required coverage.         | Accept candidate      |
| Cannon desktop               | D-075 widens the visible center viewport. The enabled Dagannoth fixture, output metrics and inventory reserve remain complete.                                                                        | Accept candidate      |
| Planner desktop              | D-075 makes the gear-pool view scroll inside the center pane; the mobile companion still covers the full chart and timeline surface.                                                                  | Accept candidate      |
| Planner mobile               | Normal-flow full content remains complete; compact wrapping changes align with D-077–D-080 and no chart or table overflow was visible.                                                                | Accept candidate      |
| Duel desktop                 | D-075 widens the matrix viewport and D-078/D-079 update search presentation. The four filtered rows and setup columns remain readable.                                                                | Accept candidate      |
| Duel mobile                  | Normal-flow matrix controls remain contained; intentional horizontal table overflow preserves the comparison columns.                                                                                 | Accept candidate      |
| Settings desktop             | D-075 bounds the recovery pane and D-078 bounds migration notices. Recovery, lower Price data and legacy-review captures preserve all required evidence.                                              | Accept candidate      |

All reviewed content came from the repository's fixed visual fixtures. No real
player name, imported user file, browser profile data, secret, token, absolute
path or raw local diagnostic appeared in the actual images. The candidate
update remains reversible until the generated PNG set and two clean read-only
runs have also been reviewed.

### Scheduled-price integration addendum

After the local commits were rebased onto scheduled-price commit `af0d2a4`, a
read-only comparison passed 15/20 scenarios. The five diffs were limited to
Dense Compare GP columns, Fire Giant Loot values, Economy scheduled snapshot
metadata/movers and Settings Price data metadata. Their actual/diff images were
reviewed against the committed `prices.json` and `price-history.json` change;
layout, controls, source warnings and fixture/privacy boundaries were
unchanged. A targeted explicit update is therefore authorized for Dense
Compare desktop, Loot desktop/mobile, Economy desktop and Settings desktop,
including detail snapshots owned by those scenarios. All other baselines must
remain byte-identical. The targeted write changed only those nine owned PNGs;
the following full read-only comparison passed 20/20 scenarios.

## 2026-07-19 release-readiness candidate review

The integrated release-readiness worktree has 31 committed Darwin snapshots.
The normal read-only comparison reaches all 20 semantic scenarios: Dense
Compare tablet and Cannon desktop pass, while the other 18 stop at their first
snapshot mismatch. To expose the later captures without changing tracked
baselines, G8 used a temporary ignored config whose only material overrides are
the snapshot and output directories. It generated all 31 candidates under
`.codex-tmp/`; the normal Playwright PNG comparator classifies 29 as mismatches
and preserves the same two tolerance passes. Two independent read-only runs
against the ignored candidate pass 20/20 in 42.6 and 49.2 seconds.

Every candidate and generated diff was agent-reviewed. The user explicitly
accepted the exact 29-snapshot candidate set after that review; the acceptance
does not extend to unrelated visual, configuration or tolerance changes.

| Surface          | Mismatching snapshots                                                                                                                                                                                            | Reviewed explanation and result                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root and Compare | `root-shell-desktop`, `root-shell-compact-landscape`, `root-shell-mobile`, `dense-compare-desktop`                                                                                                               | Current header actions and Revision 274 badge, result/price ownership and fixture values are visible. The desktop center pane is 889 px rather than 859 px; mobile remains contained and compact landscape retains its three scroll owners.     |
| Loadouts         | `loadout-melee-desktop`, `loadout-melee-details-desktop`, `loadout-ranged-desktop`, `loadout-ranged-details-desktop`, `loadout-magic-desktop`, `loadout-magic-details-desktop`, `stats-hit-distribution-desktop` | G3 shared numeric fields replace native number/spinner presentation, and the 30 px desktop width change reflows selectors and summaries. Top, detail, special-attack and hit-distribution coverage remains present without clipping or overlap. |
| Stats and Trip   | `stats-desktop`, `stats-combat-roll-desktop`, `trip-desktop`, `trip-mobile`                                                                                                                                      | Current price-warning/assumption ownership, fixture result values and G3 input presentation explain the changes. Combat-roll, XP routing, banking, recommendation and complete mobile summary remain visible and contained.                     |
| Loot             | `loot-desktop`, `loot-mobile`, `loot-action-impact-desktop`, `loot-nested-desktop`, `loot-nested-mobile`                                                                                                         | Current price-warning ownership and scheduled fixture values change composition, action-impact and nested-row dimensions. Tables remain readable; intended mobile horizontal overflow is retained and no row is accidentally hidden.            |
| Economy          | `economy-desktop`, `economy-trend-desktop`                                                                                                                                                                       | The current scheduled/local price-history fixture changes snapshot counts, movers and chart points; the desktop width also changes. The selected Big bones trend, provenance copy and chart remain complete.                                    |
| Planner          | `planner-desktop`, `planner-mobile`                                                                                                                                                                              | G4 exposes effective current XP, level-floor actions, target/lock explanations and reconciled rows. Desktop gear coverage and the full mobile plan/chart/timeline remain complete with no overflow defect.                                      |
| Duel             | `duel-desktop`, `duel-mobile`                                                                                                                                                                                    | Current saved-setup count/context and G5 lifecycle ownership explain badge and size changes; the filtered four-row matrix and comparison columns remain legible.                                                                                |
| Settings         | `settings-desktop`, `settings-price-data-desktop`, `settings-legacy-review-desktop`                                                                                                                              | G6 adds Calculation context and Revision 274, current price transfer ownership removes obsolete global actions, and recovery content shifts below them. Price data and the bounded fixture-only legacy review remain fully captured.            |

The two within-tolerance snapshots are `dense-compare-tablet` and
`cannon-desktop`; neither requires a tracked update. Review found no real
player name, imported user file, browser profile data, secret, token, absolute
path or raw parser diagnostic in any candidate. All content is deterministic
repository fixture state. The retained candidate and diff directories are
workspace-local ignored evidence, not version-controlled product artifacts.

The documented `npm run test:e2e:visual:update` path then changed exactly those
29 tracked PNGs. `dense-compare-tablet`, `cannon-desktop` and
`playwright.visual.config.ts` remained unchanged. The update run completed
20/20 scenarios, and two subsequent independent tracked-baseline read-only runs
passed 20/20 in 40.4 and 43.6 seconds. The current 31-snapshot Darwin set is the
accepted fixture-only baseline for this integrated source state.

## 2026-07-19 language, units and hierarchy review

The user-facing presentation pass first ran the complete Darwin matrix
read-only. Nine scenarios passed their accepted screenshots and 11 stopped at
their first mismatch. The actual/diff images for root/MonsterCard desktop,
compact landscape and mobile, Dense Compare desktop/tablet, Loot
desktop/mobile, Economy desktop, Planner mobile, Duel mobile and Settings
desktop were reviewed. An ignored candidate config then generated all 31
current images under `.codex-tmp/`, allowing the later Loot action/nested,
Economy trend and Settings Price data/legacy-review captures to be inspected
before any tracked write. A nested Loot locator was narrowed to the direct row
disclosure after the new technical disclosure made the old descendant-last
selector ambiguous; this changed test selection only.

The accepted tracked update changed exactly 15 screenshots:

- root shell desktop, compact landscape and mobile;
- Dense Compare desktop and tablet;
- Loot desktop/mobile and both nested desktop/mobile captures;
- Economy desktop and trend;
- Planner mobile and Duel mobile; and
- Settings desktop and Settings Price data.

The differences are explained by source-backed primary names, removal of
always-visible technical ids, explicit time/GP/XP presentation, and the short
Settings Price data hierarchy. Settings desktop also integrates the previously
reviewed Workspace backup section between Calculation context and Local state
recovery. Cannon, Trip, loadout, Stats, Loot action impact, Duel desktop,
Planner desktop and Settings legacy review stayed within the accepted
comparison or byte-identical contract and were not rewritten by the tracked
update. Review found no numeric change, missing control, table widening,
clipping, accidental overflow, real player data, imported payload, secret,
absolute path or raw diagnostic. The explicit update completed 20/20, and the
following full tracked-baseline read-only run passed 20/20 against all 31
fixture-only images. Candidate evidence remains workspace-local and ignored.

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

### Current local evidence

The 2026-07-12 reviewed D-075–D-081 update completed 19/19 scenarios. Two
immediately following read-only runs passed 19/19 and 19/19 against its 30
Darwin snapshots. D-082 then added the reviewed 640x360 snapshot: its focused
functional case passed 1/1 and the complete gates passed 74/74 functional and
20/20 visual against 31 snapshots. The focused keyboard-navigation test passed
1/1 after the skip-link hidden-state fix. Typecheck, lint, format check and
`git diff --check` also passed. The preview/build emitted only the existing
large-chunk warning. After integration with scheduled-price commit `af0d2a4`,
the reviewed nine-PNG price refresh was followed by another clean 20/20 visual
comparison; the functional gate remained 74/74.

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

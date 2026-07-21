# Testing evidence log

This document preserves dated validation, release and failure-triage snapshots.
It does not own current commands, required gates or test strategy; those remain in
[the testing guide](../technical/testing.md). Counts and artifact hashes below
apply only to the source state described by each entry.

## 2026-07-21 cross-browser release support

The durable browser release boundary now keeps the complete Chromium functional
suite separate and adds one owned CB-01 through CB-12 manifest in
`playwright.cross-browser.config.ts`. The manifest activates every Workbench
pane and covers module Workers, numeric/native/searchable inputs, reload state,
invalid-state recovery, keyboard-triggered setup and Workspace downloads,
Share hash/dialog/fallback, mocked same-origin integrations, keyboard
navigation, 390 px containment, two-page storage resolution and pane failure
isolation. Every page in the browser context contributes to the no-live-external
HTTP(S), unexpected-console-error and unhandled-page-error gates. CB-12's only
allowlist is limited to exact engine messages from its deliberately aborted Trip
module.

The final permanent gate passes 36/36 with one worker: 12/12 in Playwright
Firefox 151.0, 12/12 in desktop Playwright WebKit 26.5 and 12/12 in iPhone 13
WebKit emulation. The separately retained complete Chromium 149.0.7827.55 suite
passes 138/138, and `--list` proves it selects 138 tests while the dedicated
configuration selects only the 36 manifest project cases. The read-only Darwin
visual owner passes 26/26 without baseline writes. A deliberately empty
`PLAYWRIGHT_BROWSERS_PATH` run failed with exit code 1, the exact missing
Firefox executable path and Playwright's `npx playwright install` instruction;
the temporary empty directory was removed afterward.

The required one-time full discovery audit ran all 138 existing functional
cases once in Firefox and once in desktop WebKit: 265/276 passed in the initial
four-worker run. The 11 findings had four shared dispositions rather than
browser skips: WebKit short `Intl` output used `at` instead of the canonical
comma; pointer click focus followed Safari/WebKit semantics instead of the
keyboard-origin contract; native Planner `<details>` forward/backward Tab order
differed; and two Firefox Planner cases were resource-sensitive under four
concurrent browser workers. Shared code now normalizes the short date literal,
preserves an already focused export trigger and gives the Planner gear editor
deterministic Tab/Shift+Tab handling. Focus assertions invoke exports and
Recompute from an explicitly focused keyboard trigger. The two WebKit date
rows passed their focused rerun, the remaining seven WebKit rows passed 7/7
serially and the two Firefox Planner rows passed 2/2 serially. The durable
cross-browser gate intentionally remains one-worker and has no engine skip or
user-agent product branch.

Repository verification covers 173 source modules with no cycles, 158
client-reachable modules, eight documented external entrypoints, 1,085/1,085
unit tests and 19/19 goldens. The final artifact passes 27 files, 20 JavaScript
chunks and a 780,940 raw / 230,000 gzip entry against the unchanged D-098
limits; total size is 2,393,892 bytes and SHA-256 is
`ff6d13a948d56385f3640039402e43815fe3a5c41b16507459ba64ee47ff95b7`.

This is deterministic local Playwright engine evidence. Branded stable Safari
smoke was `not run`, so Safari support is not claimed. Physical iPhone/iPad
evidence was `not run`; mobile WebKit is explicitly emulation only. The
separate VoiceOver/Safari and NVDA manual accessibility rows also remain
`not run`, so this entry makes no screen-reader or WCAG-conformance claim.

## 2026-07-21 lazy pane loading and failure isolation

The Workbench now initializes one requested lazy family, Compare, and adds an
optional family only through the shared tab-activation action. Successfully
visited families stay mounted. The shared pane boundary publishes named
loading, sanitized loader/render failure and active `aria-busy` state without
changing persistence or calculation ownership. Stats uses the same isolation
boundary synchronously, while Workspace has a narrower Settings-local
boundary. A lazy loader failure offers Reload only; a post-load render or
lifecycle failure can remount just that pane and returns focus to the active
tabpanel after success.

The focused registry/boundary, root-boundary, shell, Economy/Settings and
deployment-readiness suites pass 45/45 tests. The production-preview pane suite passes 5/5 with a real
emitted build: cold startup excludes every unvisited pane chunk, throttled
Compare and Risk expose named loading, Risk is requested once and retains its
control value, Economy/Settings share one request, Workspace starts only under
Settings, Trip loader failure leaves Stats usable, normal Reload recovers and
the exact saved-storage snapshot remains unchanged. A failed Workspace import
leaves Calculation context and Price data available. The build keeps separate
hashed Compare, Loadout, Duel, Loot, Trip, Risk, Cannon, Planner,
Economy/Settings and Workspace chunks. Artifact validation passes 27 files,
20 JavaScript chunks and a 780,799 raw / 229,940 gzip direct entry against the
unchanged 800,000 / 230,000 limits; the deterministic artifact SHA-256 is
`ed1c337fc68e00df4133176dfd6f1e94da1f1fd5e89ea4ba0a15930194fe303b`.

The complete functional Chromium matrix passes 138/138 after the first-visit
focus owner waits for the requested pane's ready state, and the read-only
Darwin visual matrix passes 26/26 without baseline writes.

Five local cold/warm pairs (`--skip-build --runs 5`) recorded the final shell
and initial-pane checkpoints. Cold medians were 474 ms shell ready with two
JavaScript requests / 282,833 transfer bytes, then 785 ms initial Compare ready
with four requests / 364,004 transfer bytes. Warm medians were 330 ms and
539 ms respectively. Every initial-pane sample listed the two entry/runtime
paths, Compare chunk and calculation Worker; no optional unvisited pane path
appeared. These are workstation comparison measurements, not universal
latency SLAs.

## 2026-07-21 assistive-technology accessibility automation

The automated accessibility foundation now owns one typed AT-01 through AT-12
manifest, a lockfile-pinned `@axe-core/playwright` production-preview gate and
the repaired shared searchable-selector contract. The closed selector is a
native button; its focused search input owns combobox/listbox/active-descendant
state, options remain outside the tab order, the settled result count is
bounded and zero results are related to the input. Shared metric alternatives
no longer rely on prohibited ARIA naming, horizontal Stats/result and Economy
regions are keyboard reachable, and the two discovered low-contrast supporting
text styles now meet the automated threshold.

Focused manifest, selector, numeric and shell component coverage passes four
files / 16 tests. The full accessibility gate passes 13/13: twelve journey
scans plus the separate 320 CSS-pixel / 200% text reflow, skip-link focus and
Settings reachability case. The scans use WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags
and have no rule exclusion, serious/critical finding or undispositioned
lower-impact finding. The complete shell/accessibility Chromium file passes
22/22 after constraining visually hidden alternatives to their metric
container. A supplemental in-app browser inspection confirmed the visible
focused Weapon combobox, expanded trigger, listbox relationship and Escape
focus return without changing the selection. Typecheck and the 170-source /
155-client-reachable / eight-external-entrypoint zero-cycle architecture check
pass.

The first 26-scenario read-only Darwin visual run lost its preview connection
after two scenarios; that infrastructure interruption produced no image diff.
The five already completed scenarios and three fresh-server groups covering
the remaining 7, 9 and 5 scenarios together establish 26/26 passing comparisons
without baseline writes.

This is automated Chromium DOM/keyboard/reflow evidence, not a screen-reader
or WCAG-conformance claim. The required manual evidence remains open:

| Rows                | VoiceOver / stable Safari | NVDA / supported browser | Release effect                          |
| ------------------- | ------------------------- | ------------------------ | --------------------------------------- |
| AT-01 through AT-12 | `not run`                 | `not run`                | Accessibility release statement blocked |

The reproducible procedure and per-row record template are in
[the manual runbook](../technical/testing/accessibility-manual.md). No personal
player, setup or raw browser-profile values are part of this evidence.

## 2026-07-21 Duel-only legacy import readiness

Legacy migration readiness and status now come from the same non-empty import
plan. A validated saved-Duel candidate alone yields `1 compatible area`; an
empty defensive candidate yields no plan and remains review-only. The inspector,
App merge/persist path, rewrite-owned collision precedence, 12-entry cap,
legacy-key retention and dismissal semantics were not changed.

Focused view-model, inspector, adapter and panel coverage passes four files /
89 tests, including every single compatible-area family, mixed field/area
counts, invalid/computed entries, cap and collision behavior. The complete
19-test production-preview persistence/migration file passes with one worker.
Its Duel-only case proves aligned summary/plan/outcome copy, enabled keyboard
and pointer action, unchanged active rewrite target, durable saved setup,
retained `sim_input_v3`, dismissed review and reload persistence. Typecheck and
the preview build pass. This is local browser-state migration evidence and does
not broaden the allowlist, schemas, backend or deployment scope.

## 2026-07-21 Default/custom setup and autosave clarity

The ready setup context now presents the exact active Default/current-monster
Custom owner, destination-aware actions, fallback scope and exact-current-value
rewrite-setup persistence outcome. Ordinary autosave and direct setup
replacement/reset persistence share one App-owned result without changing the
six-family version-3 envelope, local-state recovery policy or Undo contracts.

Focused app-shell, recovery, adapter and conditional-owner coverage passes
eight files / 105 tests. Nine targeted production-preview Chromium
transactions cover Default/Custom ownership, reset, setup import, sharing,
legacy migration, invalid local state and cross-tab behavior. The complete
read-only Darwin suite passes 26/26 against the reviewed baselines.

The combined repository verification passes the 173-source / 158-client /
eight-external-entrypoint zero-cycle architecture gate, 1,085/1,085 unit
tests, 19/19 goldens, typecheck, production build, lint and format. The
artifact contains 20 JavaScript chunks and a 779,983-byte raw / 229,673-byte
gzip direct entry with SHA-256
`6071cf259ec7069a2d94e3f37873b227ea2f1c40565181677583f49bbdf72848`.
Real conditional loading of setup reviews, the share dialog, legacy migration
presentation/view-model and local-state attention resolved the previous D-098
overage without changing the 230,000-byte budget, persistence semantics or
user-visible transaction ownership.

## 2026-07-21 browser file-export outcomes

The browser adapter now returns a closed requested/failed result after one
pretty serialization, a connected hidden-anchor click and delayed one-shot
object-URL cleanup. Setup, saved Duel setup, PriceSet, Workspace and recovery
owners map that result to fixed started/failed copy. The flows retain their
existing envelopes and privacy boundaries; export does not close a setup
review, PriceSet reset confirmation or recovery clear action, and visible live
notices suppress an identical hidden global announcement.

Focused adapter, five-workflow controller and shared presentation coverage
passes nine files / 85 tests. The direct adapter matrix covers UTF-8 byte count,
MIME/name/`rel`, connected synchronous click, immediate anchor removal,
delayed revoke, serialization/browser-API/append/click failure and raw-error
non-disclosure. Six production-preview download transactions pass across the
five files plus injected setup failure; every actual download event carries the
existing filename and schema/privacy content. Typecheck, targeted ESLint,
format checks, build and the 167-source / 152-client-reachable /
eight-external-entrypoint zero-cycle architecture check pass.

The first complete Chromium run passed 115/119; its four failures were all the
same strict locator ambiguity introduced when the recovery notice label began
with its parent region's accessible name. Renaming only that child label to
`Recovery export notice` made the four exact reruns pass 4/4. A later final
release gate will record the next single-run full-suite count. Current evidence
is `LOCAL_RUNTIME` / synthetic browser evidence and proves download request
dispatch, not final filesystem persistence, live providers or deployment.

## 2026-07-21 cross-tab local-state conflict safety

The implemented controller owns a closed ten-area registry, exact raw
baselines, event coalescing, per-area write suspension and synchronous
pre-write freshness checks. Settings exposes metadata-only review, Workspace
rescue, fresh reload-based `Use saved data`, verified batched `Keep this tab's
data` and postimage-guarded exact-raw Undo. Safe-session storage installs no
browser listener, invalid or unsupported external values remain untouched and
the legacy-migration dismissal key stays outside the contract.

Focused controller, component, recovery and transaction coverage passes eight
files / 87 tests. Typecheck and the 165-source / 150-client-reachable /
eight-external-entrypoint zero-cycle architecture check pass. The complete
functional Chromium suite passes 117/117 with one worker, including the real
two-page stale-write, Settings-review, Keep and Undo transaction. The first
read-only Darwin visual comparison passed its first 20 scenarios before the
local preview server exited; a scoped fresh-server rerun passes the remaining
six scenarios 6/6 with no snapshot writes or image diffs. Targeted ESLint for
the new source boundary passes, while the repository-wide command remains
polluted by the existing generated `.codex-tmp/goal-dist` tree. `git diff
--check` passes. This is `LOCAL_RUNTIME` / synthetic local-browser evidence,
not an atomic-locking, multi-device-sync, live-provider or deployment claim.

## 2026-07-20 Hiscores Apply/Undo transaction

The implemented App-owned transaction rechecks normalized-player freshness,
captures an immutable exact pre-Apply form, counts only genuinely changed
supported fields and commits through the existing Default/Custom write-through
path. Its single global action is `Applied N levels`; stale and zero-change
attempts leave the form and preceding pending Undo unchanged. Undo restores the
captured form through the same path, while the retained preview derives Current
values from live form state. The controller no longer emits competing
changed-Apply success copy.

Focused Hiscores and Planner coverage passes 4 files / 39 tests. It includes
partial, missing and unchanged response values, canonical changed count,
immutable/exact snapshot, stale mutation authority, preview-retaining
no-change feedback, Apply/Undo Planner reconciliation and rejection of a late
applied-level source after Undo. The mocked Hiscores production-preview
selection passes 2/2; the extended transaction path proves `Applied 7 levels`,
no player identity in the action, a no-change second Apply preserving the
action, exact form restoration, an open/current preview in both directions and
Auto XP plus still-valid raised target semantics.

The complete functional Chromium suite passes 106/106 with one worker. Final
`npm run verify` passes 95 Vitest files / 950 tests, 19/19 goldens, typecheck,
the 149-source/134-client/eight-entrypoint zero-cycle architecture check,
production build and artifact budgets, lint and formatting. The 15-file,
two-asset, eight-JavaScript-chunk artifact totals 2,227,535 bytes; its entry is
787,630 raw / 229,007 gzip bytes and its SHA-256 is
`768ff9c7c0ff510c46facfdcbd8577b2e51427c3b25f0f7c47bafbecf666925a`.
Dependency audit remains skipped by the network-disabled gate. This is
`LOCAL_RUNTIME` / mocked `SYNTHETIC_TEST` evidence and makes no live-provider,
production-deployment or real-player-data claim.

## 2026-07-20 mobile result and navigation loop

Scope: implement the normal-flow mobile/portrait result and tab-navigation
contract without changing calculations, view models, persistence, desktop or
the 640 × 360 compact-landscape workbench.

- Before, the inspected 390 × 844 profile placed the first headline row at
  2 141.5 CSS px and 1 114.8 px after Player setup; the profile included an
  existing local-state attention notice, so this is observation evidence, not
  a permanent assertion. After, `Mobile result summary` starts at 1 038.4 px,
  13.6 px after Player setup, while document width remains 390/390 and
  `scrollX` remains zero.
- Focused component/view-model coverage: 11/11 passed, including static shell
  order, single tablist, shared metric presentation and pure minimal/bounded
  scroll targets.
- Focused production-preview Chromium: the parametrized `mobile result and
navigation loop` cases passed 3/3 at 390 × 844, 620 × 844 and 768 × 1024.
  They cover dynamic summary updates, initial arrow boundaries, one-full-tab
  reveal, More/Settings focus, Home/End/arrows, the four-action row,
  typography and containment.
- Visual review: the first read-only run exposed six missing mobile-loop
  candidates plus expected mobile/portrait typography/layout diffs. Actual and
  diff images were reviewed before the bounded update. The tightened initial
  left-boundary design then produced four inspected candidates
  (`root-shell-mobile` plus three navigation images), updated by a grep-scoped
  command. The following full read-only pass exposed a stable 237-pixel
  glyph-alignment diff in `duel-mobile` after the navigation row moved the
  downstream normal flow by 44 CSS pixels; its actual/diff pair and unchanged
  content/dimensions were reviewed before a separate scoped update. The final
  suite contains 26 scenarios / 37 fixture-only snapshots; two complete 26/26
  read-only runs after the last write prove determinism.
- Desktop and compact-landscape scenarios stayed clean in the candidate run.
  No calculation, golden, request, persisted schema, data or visual tolerance
  was changed.

Final integrated evidence: `npm run verify` passes 94 Vitest files / 937 tests,
19/19 explicit goldens, typecheck, the 147-source/132-client-reachable/eight-
external-entrypoint zero-cycle architecture check, build/artifact budgets,
lint and formatting. The artifact contains 14 files / two assets / seven
JavaScript chunks, totals 2,221,431 bytes and has SHA-256
`2348cbe19730b10f90dc2730261fe85931f604aea51c0d4a5f1049d554148011`;
the direct entry is 791,165 raw / 229,811 gzip bytes. The complete
production-preview Chromium suite passes 101/101 with one worker, and the final
visual evidence is the two consecutive 26/26 read-only runs above.

## 2026-07-19 user-facing language, units and information hierarchy

The implemented presentation owner resolves source/snapshot/row names before a
deterministic classified fallback and carries exact technical ids separately.
Focused Price/Loot/MonsterCard/Settings, field/presenter and shell coverage is
included in the complete Vitest pass: 94 files / 935 tests. It proves parent,
nested and conditional Loot name precedence, PriceSet/history-only fallback,
selectable labelled Item/Monster/Loot-row/Tag disclosures, singular/plural time
units, source game ticks versus derived seconds, uppercase GP/XP, complete
accessible compact labels and the short Settings summary derived from the same
active PriceSet presentation as Economy.

The complete production-preview Chromium gate passes 98/98 with one worker.
It includes the state-neutral `Review in Economy` tab/focus transaction, exact
id search with a human selected label, full gold-pieces/food-per-kill role
names, tick/second target and reload paths, and unchanged PriceSet import/reset,
manual-price, history, Workspace and recovery transactions. This is semantic
browser evidence, not assistive-technology certification or a WCAG-conformance
claim.

The first complete Darwin comparison passed 9/20 scenarios and produced 11
expected first-screenshot mismatches. Every actual/diff plus all 31 ignored
candidate images was reviewed. The accepted differences were source names,
primary-id removal, explicit units and the short Settings hierarchy; the
integrated Settings candidate also retained the previously reviewed Workspace
section. No numeric change, control loss, table widening, clipping, overflow,
private player data, imported payload, secret, local path or raw diagnostic was
found. The explicit update changed 15 tracked PNGs and passed 20/20; the
following full read-only comparison also passes 20/20. Candidate evidence is
workspace-local under ignored `.codex-tmp/`.

`npm run verify` passes 94 files / 935 tests, 19/19 goldens, typecheck, the
145-source/130-client-reachable/eight-entrypoint cycle-free architecture check,
the 241-module production build, artifact validation, lint, Prettier and diff
checks. The 14-file/two-asset/seven-JavaScript-chunk artifact is 2,215,181 bytes
with a 788,136 raw / 228,803 gzip direct entry and SHA-256
`b15dd9b9400b28401768b77d1513216fdb61d45597f71d09f8c0928df677f26f`.
Dependency audit remains skipped by the network-disabled gate. This is
`LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence and makes no deployment, provider or
real-user-data claim.

## 2026-07-19 Workspace atomic Apply/Undo and queue verification

The G4 Workspace/recovery/area-owner regression command passes 27 files / 245
tests. Dedicated executor coverage proves the exhaustive ten-target registry
order, preflight before writes, exact raw/missing preimages, nth-write and
nth-clear reverse rollback, rollback-failure affected ids, no live mutation
before durable success, safe-session isolation without original storage reads,
all-area durable Apply/exact raw Undo, session-only Apply/live-only Undo and
failed durable-Undo rollback. Recovery coverage passes 14 cases for bounded
batch preparation/completion, selected failure clearing, single publish,
one-shot skips and exact-raw Undo attention reconciliation. The plan matrix now
also reconciles Planner targets against the resulting setup before
serialization, preventing a later level-reconciliation effect from escaping
the one-shot persistence boundary.

The production-preview Workspace run passes 5/5. It covers nine-area export and
zero-mutation review/Dismiss, an eight-selected-area transaction whose
unselected raw value stays exact and whose one Undo restores every storage
byte, keyboard mixed Merge with unrelated Duel/history/hidden-tier rows,
different-Revision incompatibility and a forced Planner write failure. The
forced failure restores all touched bytes exactly, changes no live value,
retains the review, requires the explicit `Apply for this session` action and
keeps durable bytes identical through that action and its live-only Undo. The
complete current-source functional Chromium suite then passes 97/97 with one
worker.

Typecheck, lint and the cycle-free architecture graph pass with 144 source
modules, 129 client-reachable modules, eight external entrypoints and no
exception or orphan. `npm run verify` passes 93 files / 927 tests, 19/19
goldens, typecheck, architecture, lint, Prettier, the 240-module production
build, artifact validation and diff checks. The 14-file/two-asset/
seven-JavaScript-chunk artifact is 2,204,720 bytes with a 781,082 raw / 226,806
gzip direct entry and SHA-256
`d8f8e9910d3a109eb6b92fbc763fdc7498620b7e651d3fa73b47961b2b937501`.
An intermediate artifact correctly failed at 802,652 raw bytes; moving the
feature-owning Economy/Settings pane behind a lazy boundary restored the
unchanged D-094/D-098 budgets. Dependency audit is skipped by the gate under
the network-disabled policy.

The required read-only `Settings desktop` comparison first hit the managed
sandbox's `listen EPERM 127.0.0.1:5174` boundary and then ran through the
approved localhost path. The unchanged accepted baseline differs by 9,536
pixels, ratio 0.03. Expected/actual/diff inspection attributes the difference
to the new Workspace section between Calculation context and Local state
recovery; there is no unexplained overlap, horizontal overflow, wrong pane,
private player name, raw payload or local path. No PNG baseline was updated
without explicit human acceptance.

This is `LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence. It proves logical
all-or-rollback behavior for handled write/remove failures in one browser
execution; it does not prove browser-crash durability, a real user backup,
production deployment, accounts, server storage or cross-device sync.

## 2026-07-19 Workspace area Replace/Merge planning

The G3 Workspace plan, controller and current area-owner regression command
passes 10 files / 100 tests. The dedicated
`workspace-restore-plan.test.ts` matrix passes 12 cases covering every Replace
area, all six closed Merge policies, four Replace-only mode rejections, Duel
add/update/skip at cap 12, price-history collision/newest-first/cap-drop
behavior, manual-price backup authority and invalid 512 overflow, hidden-tier
union, both Loot identities, null selected-PriceSet fallback, current generated
high-alch authority, manual overlay, zero history append, exact/same/different
Revision, complete setup/Duel/Planner/Loot incompatibility, stale review, zero
selection and the second Hiscores privacy choice. The parser regression also
rejects duplicate Duel and price-history identities before they can enter a
plan.

Typecheck, lint and the cycle-free architecture graph pass with 143 source
modules, 128 client-reachable modules, eight external entrypoints and no
exception or orphan. The focused production-preview
`Workspace backup|workspace restore` Chromium run passes 3/3. It retains G2's
byte-for-byte zero-mutation review/Dismiss case and adds a mixed keyboard-driven
Merge preview with an unrelated current hidden-tier row plus a different-
Revision file whose incompatible setup row is disabled while unrelated rows
remain selectable. `test-results/.last-run.json` records `passed` with no failed
tests.

The authoritative `npm run verify` gate passes on the final G3 source: 92 files
/ 915 tests, 19/19 goldens, typecheck, the 143/128/eight-entrypoint architecture
check, lint, Prettier, a 239-module production build, artifact validation and
diff checks. Artifact evidence is 12 files, 2 assets, 5 JavaScript chunks,
2,183,730 total bytes, 794,657 raw / 229,994 gzip direct entry and SHA-256
`56b11d038c712dcb08509e886fe90df4523c58a084152878db7f0c91b0c47205`.
The first full gate exposed a 230,585-byte gzip entry, 585 bytes above the
accepted ceiling; moving the plan session behind its existing lazy boundary
restored compliance without changing restore semantics. The final entry is six
bytes below the current ceiling. Dependency audit was skipped by the gate in
the network-disabled sandbox.

G3 performs no storage write/remove, React feature-state mutation, recovery
transition, PriceSet acceptance, session-only Apply or Undo. Its visible Apply
control remains disabled even for a ready plan; G4 owns the executor and final
queue verification. The default Settings surface is unchanged from G2 until a
file opens the review, so this slice introduces no new default-layout visual
baseline delta; G4 still owns the final documented visual comparison required
for the completed workflow. Evidence remains `LOCAL_RUNTIME` /
`SYNTHETIC_TEST` and does not prove multi-key storage atomicity.

## 2026-07-19 Workspace safe export and Review-before-restore

The G1/G2 Workspace state, controller, pure Settings presenter and local-state
recovery commands pass eight files / 64 tests across the focused runs. They
prove exhaustive eleven-id policy, nine required canonical records, default
Hiscores exclusion plus explicit normalized opt-in, duplicate/unsafe/bounded
input rejection, latest-request-wins, raw-free unsupported/malformed rows,
current entity compatibility, the ten-row optional-Hiscores presentation,
default-off recipient privacy, exact candidate Dismiss and unchanged recovery
behavior.

The named production-preview `Workspace backup` Chromium path passes 1/1. It
downloads a Revision 274 nine-area file without the typed private fixture
player, imports that exact file, focuses `Review before restore`, renders nine
area rows, resets the file input and returns focus on Dismiss. Sorted byte-for-
byte localStorage snapshots and the visible ATT field are identical before
review, after review and after Dismiss. This is zero-mutation review evidence;
G3/G4 still own selection, Replace/Merge results, storage mutation,
session-only Apply and Undo.

Typecheck and the cycle-free architecture graph pass with 142 source modules,
127 client-reachable modules, eight external entrypoints and no exceptions or
orphans. The authoritative `npm run verify` gate passes 91 files / 902 tests,
19/19 goldens, lint, Prettier, the 238-module production build, artifact
validation and diff checks. The 12-file/two-asset/five-JavaScript-chunk artifact
is 2,172,520 bytes with a 793,830 raw / 229,717 gzip direct entry and SHA-256
`0cc16afc2263a5ec7d389f512141660f2dcfaa899250d73286d53d71cec9e128`.
The Workspace review and Settings presenter are lazy 3.78 kB and 5.79 kB chunks;
this corrected two intermediate verification failures at the direct-entry raw
and gzip budgets without changing the controller contract or UI behavior.
Dependency audit is skipped by the gate in the network-disabled sandbox.

The required read-only `Settings desktop` visual comparison first reached the
managed sandbox's expected `listen EPERM 127.0.0.1:5174` boundary and then ran
through the approved localhost path. It reports the intentional new-panel
difference against the unchanged baseline: 8,279 pixels, ratio 0.03. The actual
image was reviewed and shows the new Workspace section in the correct Settings
order with no unexplained horizontal overflow, wrong pane, private player name,
raw payload or local path. No visual baseline was updated during this non-final
feature slice. This is `LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence, not a real
user backup, deployed environment or crash-durability claim.

## 2026-07-19 safe active setup reset

The required candidate/review/persistence/Planner command passes 4 files / 70
tests. The extended focused run, including the session-only recovery-controller
regression, passes 5 files / 81 tests. It covers fresh canonical all-style
candidates, Default and current-target Custom ownership, grouped friendly
review labels, no-op/stale/duplicate safety, complete six-family persistence
and Undo, Planner non-interference and protected surrounding state.

Typecheck, the cycle-free 137-source / 122-client-reachable / eight-entrypoint
architecture graph and the 233-module production build pass. The named
production-preview Reset workflow passes 3/3 for Review/Cancel/Confirm/no-op,
durable complete Undo/reload and truthful session-only Apply/Undo. The complete
functional Chromium suite passes 91/91 with one worker in 4.9 minutes after a
compact four-action containment correction and one explicit app-ready wait in
the MonsterCard test.

The read-only visual run first reached the managed sandbox's expected
`listen EPERM 127.0.0.1:5174` boundary. Its approved localhost rerun verified
the root shell desktop and compact-landscape snapshots. The root mobile image
was reviewed and only that baseline was regenerated for the intentional 44 px
Reset action row. A bounded rerun shows Economy desktop passing; three
pre-existing Reset-external 1 px / 0.01-ratio mobile differences remain in
Loot, Planner and Duel and their baselines were not changed by this goal. This
is `LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence, not deployed or provider
evidence.

The final `npm run verify` gate passes the same 137/122/eight-entrypoint
architecture graph, 88 files / 877 tests, 19/19 goldens, lint, Prettier,
production build, artifact validation and diff checks. The 10-file artifact is
2,147,223 bytes with a 779,232 raw / 226,183 gzip direct entry and SHA-256
`a5dea13d288ca9950e17275a446bfaa9b0820962ddcc1db367795fd5b4a58f17`.
Dependency audit is skipped by the verification script in the network-disabled
sandbox. Two earlier gate attempts exposed that the generated all-monster,
all-style numeric invariant could take 5.4-7.6 seconds under full parallel
load despite passing in 0.76 seconds alone; its case-local harness timeout is
now 15 seconds, and the final full run passes it in 3.26 seconds without any
calculation or assertion change.

## 2026-07-19 application error boundary and safe-session recovery

The focused application recovery command passes 3 files / 23 tests. It proves
the fixed runtime-bootstrap presenter, post-ready render and lifecycle
replacement, raw message/path/stack exclusion, both actions, normal reload,
tab-flag and query-fallback memory selection before any localStorage property
read, path/query/fragment preservation and independent session-only health
semantics.

Typecheck, the cycle-free 135-source / 120-client-reachable / eight-entrypoint
architecture graph, the 231-module production build, focused ESLint/Prettier
and `git diff --check` pass. The named production-preview Chromium recovery
transaction passes 1/1 and preserves the original saved setup through failure,
safe reload and later safe-session editing by comparing a sorted byte snapshot
of every localStorage key and value. The first managed startup check hit
the sandbox's `listen EPERM 127.0.0.1:4179` boundary; the approved localhost
rerun passed with one ready marker, one controlled error marker and verified
asset routing, then exited its managed server. This is `LOCAL_RUNTIME` /
`SYNTHETIC_TEST` evidence, not production evidence.

## 2026-07-19 calculation lifecycle worktree verification

The current shared worktree contains the implemented Dense/Planner/Risk
failure-and-Retry lifecycle plus adjacent application-recovery and specification
work. The lifecycle-focused controller, pane and calculation-task command passes
7 files / 39 tests. Its production-preview Chromium workflow passes 1/1 after
covering first and refresh failure, retained previous output, fixed safe Retry,
ready recovery and raw-detail exclusion for all three calculation paths.

The broader `npm run verify` execution passes typecheck, the 135-source /
120-client-reachable / eight-entrypoint architecture graph with no cycles,
86 files / 865 unit and integration tests, 19/19 goldens, lint, production build
and artifact validation. The 10-file/two-asset/three-JavaScript-chunk artifact is
2,133,357 bytes with a 768,434 raw / 222,945 gzip direct entry and SHA-256
`f0511fb55747060875465c3f6d534175e496bfc1481a470a66e113b1d65b32bd`.
The command exits 1 only at the final repository-wide Prettier check because the
pre-existing, unrelated untracked
`docs/technical/active-setup-reset-spec.md` is not formatted. The complete
lifecycle source/test/document set passes scoped Prettier and `git diff --check`.

The complete production-preview functional Chromium gate passes 88/88 with one
worker in 2.5 minutes. Browser servers exit after the run. This is
`LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence, not production evidence.

## 2026-07-19 release-readiness finishing integration

The integrated G1-G7 source state passes the authoritative `npm run verify`
gate. Typecheck and the architecture graph pass with 132 production source
modules, 117 client-reachable modules, eight external entrypoints, no cycles
and no exceptions. Vitest passes 85 files / 852 tests, the explicit golden gate
passes 19/19, the production build transforms 229 modules, and lint, Prettier
and `git diff --check` pass. Artifact validation reports 10 files, two assets,
three JavaScript chunks, 2,124,449 total bytes and a direct entry of 760,289
raw / 221,237 gzip bytes. Its SHA-256 is
`75e9a1f3c6933b0f699485142050ea8c7b9f3df99499ca0c2b7520d510337e54`;
12 prior artifact snapshots remain in history. Dependency audit was skipped by
the verification script because this sandbox has network access disabled.

The complete production-preview Chromium run passes 86/86 with one worker in
1.8 minutes. This covers the integrated local-state attention, setup
Review/Apply/Undo, shared numeric draft lifecycle, Planner reconciliation,
Duel matrix lifecycle, generated Revision 274 presentation and contextual
setup/saved-setup/share transfer paths in addition to the existing functional
suite.

The separate visual command first reached the expected managed-sandbox
`listen EPERM 127.0.0.1:5174` boundary. Its approved localhost-only read-only
rerun completed all 20 scenarios: Dense Compare tablet and Cannon desktop pass,
while the other 18 stop at their first mismatch against the 31 committed Darwin
snapshots. A temporary ignored-only config then generated all 31 current-state
candidates without changing tracked baselines or visual configuration. The
production Playwright comparator reports 29/31 mismatches; Cannon desktop and
Dense Compare tablet remain within tolerance. All candidate/diff images were
agent-reviewed. They show the integrated revision/context, shared numeric-
field, Planner, Duel, price-fixture and ownership changes plus the already
observed 30 px desktop pane-width drift, with no unexplained clipping, overlap,
wrong pane, private player/import data, secret, local path or raw diagnostic.
Two independent read-only comparisons against the ignored candidate pass 20/20
in 42.6 and 49.2 seconds, establishing local determinism.

The semantic setup steps and complete functional suite remain green, so the
old tracked-baseline result was retained as review evidence rather than
classified as a functional regression. The user then explicitly accepted the
reviewed set. `npm run test:e2e:visual:update` changed exactly the 29 significant
PNG mismatches, left Dense Compare tablet, Cannon desktop and the comparator
configuration untouched, and completed 20/20 scenarios. Two subsequent
independent `npm run test:e2e:visual` comparisons pass 20/20 in 40.4 and 43.6
seconds. The current 31-snapshot Darwin baseline is therefore reviewed and
green. The grouped review and exact snapshot set are recorded in [the visual
regression specification](../technical/visual-regression-spec.md#2026-07-19-release-readiness-candidate-review).

## 2026-07-17 PriceSet import discoverability

D-102 implementation validation confirms that full-PriceSet transfer now has
one advanced Market owner rather than global-header and Settings duplicates.
The focused controller/component command passes 3 files / 27 tests, covering
the one-disclosure DOM and copy contract, unscoped notice, unchanged generated
high-alch/manual-overlay/persistence/history transaction, reset semantics and
header action removal. The named production-preview Chromium run passes 5/5:
global setup actions, full PriceSet round trip, recoverable invalid import,
compact landscape and narrow mobile containment. Port 5173 was already in use,
so the run used an otherwise identical temporary port-5175 config that was
removed afterward.

Typecheck, lint, formatting, `git diff --check` and the cycle-free 125-source /
110-client-reachable / eight-entrypoint architecture gate pass. Production
build transforms 222 modules. Artifact validation reports 10 files, two assets,
2,095,263 total bytes, 736,565 raw / 213,862 gzip entry JavaScript, three
JavaScript chunks and SHA-256
`1b6f6b11a9eb06ee663bf5bc0e3a894fb991648fbf79045fa22b88ab495722f2`.

Full `npm run verify` reaches 79 passing files and 798 passing tests out of
80/799. Its only failure is the independently stale legacy Planner parity
baseline already classified below; all D-100–D-102 focused and full-suite tests
pass. The Planner baseline was not regenerated as part of the PriceSet
presentation change.

## 2026-07-17 price-warning relevance and presentation

D-101 implementation validation confirms that price notices retain structured
item/consumer/current-result/Loot-row context, while Result, Loot and Economy
render their non-duplicated ownership contracts. The focused domain,
view-model and component command passes 8 files / 103 tests. It includes Bury
and Skip exclusion, exact one-GP coin suppression, active versus zero-use food
and cannonball paths, issue/note classification, item labels, row-local nested
notices, absence from Active assumptions and the complete controlled Economy
disclosure. `npm run typecheck`, lint, the 124/109/eight-entrypoint architecture
gate, 19/19 golden tests and `git diff --check` pass.

The focused production-preview Chromium run passes 35/35 across
`cannon-trip-loot.spec.ts` and `shell-accessibility.spec.ts`, including the
imported-PriceSet Result/Loot/Economy flow, disclosure focus transfer and the
absence of passive price-list overflow. Port 5173 already belonged to the
repository's checked development server, so this run used an otherwise
identical temporary port-5174 config that was removed after the run. The
production build passes with 221 modules. Artifact validation reports 10 files,
two assets, 2,093,064 total bytes, 735,789 raw / 213,457 gzip entry JavaScript,
three JavaScript chunks and SHA-256
`724822183fbcdc86db42999385cde02e4eba4fd2b920d02735e9f220dbdce164`.

The complete unit suite excluding the independently stale Planner parity audit
passes 79 files / 791 tests. Full `npm run verify` reaches 79 passing files and
796 passing tests out of 797, then stops at the Planner baseline assertion: all
reference-context rows gained `incoming-attack-compatibility-fallback`, and two
current-product magic rows gained `incoming-attack-partial-model`. The committed
baseline already contains `price-fallback-used`, so this is not a D-101 price-
notice delta and its generated baseline/report were left unchanged. A final
repository-wide `npm run format:check` is separately blocked by concurrent
PriceSet-import edits in `src/app/components/panes/economy-settings-pane.tsx`;
the D-101 source and documentation set passed Prettier before that external
edit arrived.

Follow-up on 2026-07-17 resolved that Planner baseline failure. Review confirmed
that D-081 had intentionally added only the visible incoming-attack coverage
warnings: `incoming-attack-compatibility-fallback` in all 16 reference-context
rows and `incoming-attack-partial-model` in two current-product magic rows.
Training order and the previously classified bounded numeric, configuration and
transition differences were unchanged. The reviewed baseline and generated
report now retain 29 `accepted-rewrite-delta` and three `source-data-delta`
rows, with zero `needs-review` or `rewrite-gap` rows. `npm run planner:parity`
passes 19/19 tests and all 32 comparisons; the full `npm run verify` gate passes
80/80 unit files, 799/799 unit tests, 19/19 goldens, architecture, typecheck,
build/artifact, lint, Prettier and diff checks.

## 2026-07-13–15 structural validation snapshots

D-099 GitHub Actions disablement validation note, 2026-07-15: the only
repository workflow was moved from `.github/workflows` to the retained
`.github/disabled-workflows/update-market-prices.yml` template. The focused
workflow-security and deployment-readiness suites pass 17/17, including an
explicit assertion that no active workflow YAML exists. The affected Economy
and shell Chromium specs pass 25/25 with the disabled-refresh copy. Full
`npm run verify` passes 80 files / 788 tests plus 19 goldens, architecture
124/109 with eight external entrypoints, typecheck, build/artifact, lint,
format and diff gates. The resulting 10-file/two-asset artifact is 1,976,291
bytes with a 721,543 raw / 209,175 gzip entry, three JavaScript chunks and
SHA-256
`fea2d14a96a429d221c695e8aed699a8231ac6c6f8c0dc188dcf48cadc120f39`.
The committed/imported/manual price paths remain available; no scheduled-run
freshness evidence is claimed while D-099 is active.

D-098 direct-entry budget rebaseline validation note, 2026-07-15: the release
gate now allows 800,000 raw / 230,000 gzip direct entry JavaScript while
retaining D-094's asynchronous generated-runtime boundary. The focused
deployment-readiness suite passes 13/13, typecheck and the 124/109/eight-root
architecture check pass, and full `npm run verify` passes 80 files / 787 tests
plus 19 goldens, build/artifact, lint, format and diff gates. The unchanged
10-file/two-asset artifact is 1,976,282 bytes with a 721,534 raw / 209,167 gzip
entry, three JavaScript chunks and SHA-256
`fa514545d3cfdaf3ddfbe1e4e2b17d0737b57c3dd8e793afa0c7af2056b227e6`;
the 880,362-byte generated runtime remains a separate deferred chunk. The first
sandboxed startup measurement reached the expected `listen EPERM` boundary;
the approved localhost rerun completed five cold/warm pairs on Playwright
Chromium 149.0.7827.55 with 236/167 ms app-ready and 28/20 ms
first-contentful-paint medians. The rebaseline changes no artifact, chunk,
startup behavior or total-transfer claim and does not create a universal
wall-clock SLA.

Local development startup reliability validation note, 2026-07-15: the static
root now exposes readable `starting` and no-JavaScript content before the
external DOM-only guard and application entry. Existing React branches own the
single canonical `starting`/`ready`/`error` marker. The fresh strict-port
`npm run test:startup:dev` smoke first hit the managed sandbox's expected
`listen EPERM`; the approved localhost rerun passed with one `ready` marker,
zero startup warnings, one sanitized controlled-failure `error` marker, direct
JSON and HEAD responses as `application/json; charset=utf-8`, and the Vite raw
transform as `text/javascript`. Focused startup/middleware/deployment suites
pass 20/20. The complete production-preview Chromium gate passes 78/78, and
full `npm run verify` passes 80 files / 787 tests plus 19 goldens,
architecture 124/109 with eight external entrypoints, typecheck,
build/artifact, lint, format and diff gates. The 10-file/two-asset artifact is
1,976,282 bytes, entry JavaScript 721,534 raw / 209,167 gzip, three JavaScript
chunks and SHA-256
`fa514545d3cfdaf3ddfbe1e4e2b17d0737b57c3dd8e793afa0c7af2056b227e6`.
Five paired canonical-marker samples on Playwright Chromium 149.0.7827.55 have
304 ms cold and 203 ms warm app-ready medians, with 32 ms cold and 16 ms warm
first-contentful-paint medians. These are current-workstation evidence, not a
universal latency budget or a replacement for D-094's accepted before/after
comparison.
The final checked user handoff emitted
`APP_READY http://127.0.0.1:5173/` after a fresh Chromium probe and left that
verified managed Vite process running.

D-097 global Hiscores provider-budget validation note, 2026-07-14: the
runtime-neutral handler checks the asynchronous aggregate gate after validated
input and the in-isolate client limiter but before the provider. One
deterministically named SQLite Durable Object atomically persists only fixed
60-second window/config/count state; mode `off` bypasses the binding, while
invalid enforcing configuration, coordinator failure and the one-second gate
timeout fail closed without a provider request. The focused core/coordinator/
Worker/adapter/provider command passes 5 files / 39 tests. The account-free
lockfile-pinned Wrangler 4.109.0 dry run recognizes the Durable Object binding,
v1 SQLite migration, Static Assets binding and committed `off` variable without
uploading. Full `npm run verify` passes 79 files / 782 tests plus 19 goldens,
architecture 122/109, typecheck, build/artifact, lint, format and diff gates.
Separate `npm audit --json` covers 353 dependencies with zero known
vulnerabilities. The server-only change leaves the 10-file/two-asset artifact
at 1,974,877 bytes, entry JavaScript 720,422 raw / 208,739 gzip and SHA-256
`babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`.
Enforcement, quota, WAF configuration and deployed rollback evidence remain
intentionally unclaimed.

Repository-wide maintainability cleanup validation note, 2026-07-14: 21
unused declarations/helpers and the proven dead rewrite/legacy selector
families are removed without calculation, persistence, API, fixture or
baseline changes. The architecture check passes at 121/109 with seven external
entrypoints and no cycle or exception. Numeric audit compares 5,958/5,958 paths
with zero mismatch and all 19 goldens pass. Complete production-preview
Chromium passes 78/78 with one worker in 3.3 minutes. Because CSS changed, the
read-only Darwin visual suite was rerun: its first sandboxed preview start
failed with environment-only `listen EPERM` on port 5174, and the approved
localhost rerun passed 20/20 in 1.4 minutes against the unchanged 31 baselines.
Full `npm run verify` passes 78 Vitest files / 770 tests plus 19 goldens,
typecheck, architecture, build/artifact, lint, format and diff gates. The
10-file/two-asset artifact totals 1,974,877 bytes with entry JavaScript at
720,422 raw / 208,739 gzip bytes and SHA-256
`babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`.
The exact disposition and retention ledger is in
[the maintainability cleanup audit](maintainability-cleanup.md).

ARCH-2026-05 feature test-suite split validation note, 2026-07-14: static title
comparison preserves all 75 current scaffold cases and all 90 split-time
composed view-model cases. Playwright collection reports the unchanged 78 tests
in nine feature specs, and the complete production-preview Chromium gate passes
78/78 with one worker in 2m 12s. The focused split boundary passes 10 files / 98
tests including formatting and direct MonsterCard owners. Numeric audit remains
5,958/5,958 with zero mismatches and all 19 goldens pass. Full
`npm run verify` passes 78 files / 770 tests plus 19 goldens, architecture
121/109, typecheck, build/artifact, lint, format and diff gates. The current
10-file/two-asset artifact totals 1,974,877 bytes with entry JavaScript at
720,422 raw / 208,739 gzip bytes and SHA-256
`babdae8745eff2ec18ae99c9c7978a2b830480315abae8c3a6121d97e43048e3`.
The split changes no production source, fixture, visual snapshot, Playwright
configuration or deployment contract; the existing read-only 20/20 visual
result remains applicable and no new visual run is claimed.

Legacy migration internal-split validation note, 2026-07-14: the unchanged
public facade composes six direct internal owners and remains the only
production import path. The former 41-case combined state suite is split into
policy 7, setup 14, preferences 13 and prices 7; the three presentation cases
keep the focused boundary at 44/44. Architecture passes at 121/109 with no
cycle, exception or orphan. Focused Import/Keep/Clear Chromium passes 3/3 and
the complete functional suite passes 78/78. Full `npm run verify` passes 71
files / 770 tests plus 19 goldens and produces the 10-file/two-asset,
1,977,466-byte artifact with SHA-256
`057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`;
entry JavaScript remains inside D-094 at 720,528 raw / 208,747 gzip bytes. No
storage key, report field, mapping rule, precedence, D-048/D-049 boundary,
atomic App Apply transaction, formula, UI copy, CSS, visual baseline, API or
deployment contract changed.

App composition-root retention validation note, 2026-07-14: AST/source
inspection confirms the accepted 2,573-line owner has 46 state cells and nine
effects: seven direct persistence owners, one runtime-bootstrap Apply and one
minute presentation clock. App retains global status/Undo and caller-owned
setup/share/legacy transactions; no source code, markup or styling changed.
The six focused shell/bootstrap/recovery/transfer suites pass 57/57 and full
`npm run verify` passes 71 files / 770 tests plus 19 goldens, architecture
121/109, typecheck, build/artifact, lint, format and diff gates. The immediately
preceding exact source tree passed Chromium 78/78; the latest applicable
read-only visual evidence remains 20/20. No new browser/visual run is claimed
for this documentation-only accepted-boundary closure.

Trip D-096 retention validation note, 2026-07-14: source/reference
inspection confirms the 3,097-line pure domain boundary has 55 exports, of
which 29 are referenced outside the file and 26 are currently internal-only.
Consumers use the stable `src/domain/trip` boundary; no cycle, exception,
revert/conflict loop, suppression or test-isolation failure activates a split.
The Trip-specific retention specification keeps formulas, PriceSet lookup and
warnings, result shapes, numeric evidence and goldens unchanged. The focused
Trip suite passes 42/42, numeric audit passes 5,958/5,958 with zero mismatches,
all 19 goldens pass and full `npm run verify` passes 71 files / 770 tests plus
architecture 121/109, typecheck, build/artifact, lint, format and diff gates.
Browser and visual gates are not required or claimed for this
documentation-only retention closure.

Game-data generator D-096 retention validation note, 2026-07-14:
source/reference inspection confirms the 3,170-line script core has 42 exports,
14 repository-external references and 28 internal-only exports. Consumers are
limited to the generation CLI, impact reporter and focused tests. Raw
`lostcity-content-*` parser leaves flow into snapshot composition and then the
core; no parser imports the core back. The generator-specific retention
specification preserves repository-contained path planning, output hygiene,
source-slice normalization, deterministic JSON/Markdown artifacts and impact
evidence. Focused parser/generator tests pass 56/56. The fixture-owned real CLI
dry run resolves 371 items and 65 monsters, reports the exact three expected
output paths and writes no files. Full `npm run verify` passes 71 files / 770
tests plus 19 goldens, architecture 121/109, typecheck, build/artifact, lint,
format and diff gates. Generator source and committed artifacts are unchanged.

Calculation Worker D-095 retention validation note, 2026-07-14: source
inspection confirms the four-kind raw request/result protocol, 30-second
default timeout, Worker termination on every settlement and fixed sanitized
cancel/failure errors. Dense owns 250 ms debounce plus source/deactivation
cleanup; Planner owns explicit Recompute plus current-source refresh; Duel owns
intent/busy/stale explicit rebuild and unmount cancellation; Risk owns explicit
latest/fresh/source/Cancel behavior. The direct task/controller/performance gate
passes 5 files / 22 tests, architecture passes at 121/109, typecheck passes,
numeric audit remains 5,958/5,958 and all 19 goldens pass. Full
`npm run verify` passes 71 files / 770 tests plus 19 goldens and produces the
unchanged 10-file/two-asset, 1,977,466-byte artifact with entry 720,528 raw /
208,747 gzip and SHA-256
`057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`.
The existing five-pair D-095 timing capture remains applicable; no new
workstation, browser or visual run is claimed for the documentation-only
retention closure.

Simulation/MonsterCard ownership validation note, 2026-07-14: the direct
`monster-card.ts` owner has six focused cases for attack-type/defence mapping,
sparse source values, setup presentation, supplied-combat reuse and sorted
target options. The large `ui-view-model.test.ts` owner is reduced from 93 to 90
cases while retaining one composed-result assertion; the required combined gate
passes 117/117. Numeric audit remains 5,958/5,958 with zero mismatches and all 19
goldens are unchanged. Focused MonsterCard Chromium passes 3/3, complete
Chromium 78/78 and the read-only Darwin visual suite 20/20 without a baseline
write. The first visual preview start was sandbox-blocked with `listen EPERM` on
`127.0.0.1:5174`; the approved localhost-only rerun passed. Full
`npm run verify` passes 68 files / 770 tests plus 19 goldens and the 115/103
architecture gate. The 10-file/two-asset artifact totals 1,977,448 bytes with
SHA-256
`2f88f6dcf4768b6fdb64adfd8b8eb9b46eb7a34a8aa5b2d51ce0157b7fbd5e8f`;
entry JavaScript remains inside D-094 at 720,510 raw / 208,681 gzip bytes. No
formula, `FullSimulationResult`, request, persistence, UI copy, CSS, visual
baseline, API or deployment contract changed.

Code-audit validation note, 2026-07-14: `formatting.test.ts` owns duration
minute-rollover boundaries and `storage-adapter.test.ts` distinguishes missing
from present-but-empty persisted state. Price-history presentation and
local-state recovery/controller suites remain green, while a controlled-clock
Chromium case proves that visible Economy history age advances without another
user action. The full Chromium suite passes 78/78. Full `npm run verify` passes
67 test files / 767 unit tests plus 19 explicit goldens, architecture,
typecheck, build/artifact budgets, lint, formatting and diff checks. The
10-file/two-asset artifact is 1,977,448 bytes with SHA-256
`bed35127819bd2e601e1d826a3438a1c78a9bff7d0f8f02bb113bf53235d9c37`;
entry JavaScript remains inside D-094 at 720,510 raw / 208,717 gzip bytes. No
calculation formula, persistence schema, API contract, visual baseline or
deployment shape changed.

Current architecture audit validation note, 2026-07-14: the fresh source graph
passes with 114 modules, 102 client-reachable modules, seven documented external
entrypoints and no cycles, layer violations, exceptions, orphan modules or stale
entrypoint classifications. The focused legacy migration boundary passes 44/44,
and full `npm run verify` passes 65 test files / 764 unit tests plus 19 explicit
goldens, typecheck, build/artifact budgets, lint, formatting and diff checks.
The 10-file/two-asset production artifact remains 1,977,623 bytes with SHA-256
`8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`;
entry JavaScript remains inside D-094 at 720,793 raw / 208,770 gzip bytes. No
calculation, persistence schema, API, UI or deployment-shape source changed in
the architecture audit.

App composition-root Phase 4 validation note, 2026-07-14: the new DOM-free
`app-shell` and `legacy-migration` view-model suites plus static shell-component
contracts pass 12/12; the required combined focused gate passes 278/278. Numeric
audit remains 5,958/5,958 and all 19 goldens are unchanged. Focused Chromium
passes 19/19, complete Chromium 77/77 and read-only Darwin visual comparison
20/20 against the same 31 reviewed PNGs. No CSS or visual baseline changed. The
10-file/two-asset artifact totals 1,977,328 bytes with SHA-256
`bea79ca8f4dd82815ea01397b54ae7987d130bdaa6acbf5c316ecbf7b2188379`;
entry JavaScript remains inside D-094 at 720,793 raw / 208,801 gzip bytes.

Calculation-worker D-095 validation note, 2026-07-14: the typed measurement
envelope leaves raw production request/responses unchanged and adds three
focused worker-boundary cases; the combined calculation/performance gate passes
10/10. `npm run worker:measure -- --runs 5` completed 80 production-worker tasks
across typical/heavy Dense, Planner, Duel and Risk cases, and the matching
summary capture completed another 80 with all clocks aligned. Warm request
posting for 0.90-1.09 MB JSON-shaped inputs is 1.6-2.3 ms median,
startup/delivery 31.8-56.7 ms and total non-execution overhead about 34-59 ms.
Dense has the largest relative share at about 25% while remaining 137.7-140.8
ms median total; Planner, Risk and heavy Duel are execution-dominated. D-095
retains the cancellable one-shot worker. Numeric audit remains 5,958/5,958 and
goldens 19/19. The measurement artifact is isolated from `dist`; the production
artifact remains 10 files/two assets and totals 1,977,623 bytes with SHA-256
`8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`.

Risk Phase 3E validation note, 2026-07-13: `risk-controller.test.ts` adds five
cases for defaults/options, explicit Run, stale retention, source cancellation,
latest settlement, explicit Cancel, sanitized unavailable state and unmount;
`risk-pane.test.ts` adds four server-render contracts for landmark/control/output
order, running buttons, captured stale controls and unbounded formatting. The
required combined Risk/domain/request/Trip/UI command passes 161/161, numeric
audit 5,958/5,958, goldens 19/19, focused Risk Chromium 1/1, complete Chromium
77/77 and read-only Darwin visual 20/20. No baseline changed. The first visual
preview attempt was sandbox-blocked on port 5174; the approved localhost-only
rerun passed.

Visual delivery note, 2026-07-13: accumulated topbar ownership, workbench,
conditional-loot, manual-price and scheduled-snapshot changes intentionally
changed 28/31 Darwin PNGs. Direct candidate review found and fixed a mobile-only
topbar `flex-basis` gap before accepting the images. The explicit update then
passed 20/20; the normal read-only comparison remains the final visual gate.

Worktree validation note, 2026-07-13: the Goal 1 ownership refactor moves
legacy-to-rewrite mapping into `src/app/state/legacy-storage-migration.ts`.
`npm run architecture:check` passes with 63 source modules, no cycles, 50
client-reachable modules and zero exceptions. The focused migration/UI-adapter
suites pass 92/92 and the production-preview Import/Keep/Clear gate passes 3/3.
Full `npm run verify` passes 623 unit tests, 19 explicit goldens, typecheck,
build/artifact, lint, format and diff checks; `npm audit` reports zero
vulnerabilities. The unchanged 9-file artifact SHA-256 is
`e4483f07ff847bab7209380bf6aed7926fe33826c51f51bf05bba4c85ff7b763`.

Goal 2 phase 1 then extracts shared controls and pure presenters from
`src/app/App.tsx` according to
[app-composition-root-refactor-spec.md](../technical/app-composition-root-refactor-spec.md).
The focused UI adapter/view-model gate passes 144/144 and the complete
production-preview Chromium gate passes 76/76. Final `npm run verify` passes 623
unit tests, 19 explicit goldens, architecture/type/build/artifact/lint/format and
diff checks. The architecture graph contains 68 source modules, no cycles, 55
client-reachable modules and zero exceptions. The structural move produces a
9-file artifact SHA-256 of
`9fdbd3b5484a815fd5075a6787d4d8b4c794ab72fad5abb5696849956294240d`;
the changed hash reflects module/build output identity, while the file count and
visible/numeric browser contracts remain covered by the passing gates.

Goal 3 adds the implemented
[startup and bundle performance contract](../technical/startup-bundle-performance-spec.md).
Five paired Chromium samples on the same workstation measured the pre-split
cold medians at 240 ms app-ready / 112 ms FCP and the post-split medians at 241
ms app-ready / 80 ms FCP. Warm app-ready was 167 ms before and 168 ms after.
The direct entry changed from 1,562,480 raw / 245,210 gzip bytes to 683,659 raw
/ 197,123 gzip bytes; the 880,362-byte generated-runtime chunk is deferred, so
total cold JavaScript transfer remains effectively unchanged. The artifact gate
now enforces 725,000 raw / 210,000 gzip entry limits and reports three JavaScript
chunks. Focused generated-runtime/deployment/performance tests pass 23/23 and
the complete production-preview Chromium gate passes 76/76. Final
`npm run verify` passes 624 unit tests, 19 explicit goldens, architecture,
typecheck, build/artifact entry budgets, lint, format and diff checks.

Goal 4 implements
[the MetricList presenter hygiene contract](../technical/metric-list-presenter-hygiene-spec.md).
The generic presenter/type now live in `app-presenters.tsx`, all eleven
consumers use the readonly props-object JSX API and the fragment preserves the
existing no-wrapper DOM. Typecheck, the 68-module architecture graph, ESLint and
repository-wide Prettier checks pass with zero cycles and zero exceptions. The
complete production-preview Chromium gate passes 76/76 across the shared metric
consumers. Final `npm run verify` passes 624 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
The 10-file/two-asset artifact is 1,939,428 bytes with SHA-256
`fb376bc3a342857ed4b7d1f507b543330b85cb308e12bc5ab9f23e2bd1a77c4f`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 5 implements
[the runtime bootstrap controller contract](../technical/runtime-bootstrap-controller-spec.md).
The dependency-injected resolver and lifecycle hook own generated-runtime
loading, setup/Duel compatibility and selected/scheduled/bundled/manual startup
price resolution; `App.tsx` applies one idempotent typed result before enabling
persistence. The focused resolver suite passes 11/11 and the combined controller,
market UI, UI adapter and generated-runtime suites pass 106/106. The targeted
production-preview startup/recovery gate passes 3/3. Architecture passes with 70
source modules, no cycles, 57 client-reachable modules and zero exceptions. The
10-file/two-asset artifact keeps the generated snapshot in an 880,362-byte
deferred chunk and reports a 685,731 raw / 197,749 gzip entry plus SHA-256
`7aa9d4e6eae551a86992c72abf14e8af09fab4beb61491caf3c42a66abb4b51f`.
Final `npm run verify` passes 635 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
Dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 6 implements
[the local-state recovery controller contract](../technical/local-state-recovery-controller-spec.md).
The DOM-free core and thin React hook own health/report/failure/block/skip,
versioned persistence, allowlisted clear/export and explicit outcomes. The pure
Settings component owns the unchanged recovery markup and copy; `App.tsx`
retains feature values/effects and the manual-price reset reaction. Ten focused
tests bring the combined recovery/health/UI-adapter/market gate to 109/109. The
targeted production-preview gate passes 4/4 and the complete Chromium gate
passes 76/76. Architecture passes with 73 source modules, no cycles, 60
client-reachable modules and zero exceptions. Final `npm run verify` passes 645
unit tests, 19 explicit goldens, architecture/type/build/artifact entry budgets,
lint, format and diff checks. The direct entry is 690,492 raw / 198,906 gzip
bytes and the 10-file/two-asset artifact SHA-256 is
`42ec8a2e9ad83a80e6c0d6861cdf39ddf47690631716301c38912c2e9075a4f1`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 7 implements
[the Hiscores lookup controller contract](../technical/hiscores-lookup-controller-spec.md).
The DOM-free core and thin external-store hook own status, player input,
latest-request freshness, preview/notices and last-player recovery. The topbar
panel owns the unchanged DOM and disclosure-scoped focus interaction, while
`App.tsx` retains current-form row derivation and the typed Apply mutation
bridge. Nineteen focused tests bring the required combined Hiscores/recovery
gate to 55/55. The targeted mocked Chromium gate passes 2/2 and the complete
Chromium gate passes 76/76. Architecture passes with 76 source modules, no
cycles, 63 client-reachable modules and zero exceptions. Final
`npm run verify` passes 664 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
The direct entry is 693,270 raw / 199,784 gzip bytes and the 10-file/two-asset
artifact SHA-256 is
`9fee2ce16c8a5d0a39d853d8d9c0991f1eb99343bea795c2f7b291738638765d`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 8 implements
[the rewrite setup file-transfer controller contract](../technical/setup-file-transfer-controller-spec.md).
The generic DOM-free core and thin external-store hook own bounded file reading,
existing parser invocation, fixed sanitized notices, recovery-aware persistence
and deterministic export envelopes. `App.tsx` retains the six live setup state
owners, typed ready-outcome Apply, input reset and unchanged topbar JSX. Twelve
focused tests bring the required controller/parser/UI-adapter/recovery gate to
78/78. The targeted Chromium gate passes 2/2 and the complete Chromium gate
passes 77/77. Architecture passes with 78 source modules, no cycles, 65
client-reachable modules and zero exceptions. Final `npm run verify` passes 676
unit tests, 19 explicit goldens, architecture/type/build/artifact entry budgets,
lint, format and diff checks. The direct entry is 694,107 raw / 200,282 gzip
bytes and the 10-file/two-asset artifact SHA-256 is
`be5fffa96594804531c3dedb7e16b0accd0751977fcb338b1b779cc0094f7b0f`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goals 9 and 10 implement
[the PriceSet transfer controller](../technical/price-set-transfer-controller-spec.md) and
[the Cannon pane extraction](../technical/cannon-pane-extraction-spec.md). The DOM-free
PriceSet controller owns bounded import, generated-alch/manual-overlay
acceptance, selected persistence/recovery, latest-state history update, export
and reset. The pure Cannon pane owns its unchanged presentation derivation and
markup behind explicit values/actions, while `App.tsx` retains live runtime
state application, current-monster schema mutation and Trip synchronization.
The PriceSet combined unit gate passes 57/57, Cannon focused suites pass
138/138, the targeted production-preview gate passes 4/4 and complete Chromium
passes 77/77. Architecture passes with 81 source modules, no cycles, 68
client-reachable modules and zero exceptions. Final `npm run verify` passes 694
unit tests, 19 explicit goldens and all non-network gates. The direct entry is
698,137 raw / 201,103 gzip bytes and the 10-file/two-asset artifact SHA-256 is
`00193bd3b92bf8f1faf6c25eca880ff74f5106f483e3dd3998bf8966e33b62bf`.

## 2026-07-14 security-audit validation snapshot

Security-audit validation note, 2026-07-14: the focused
Worker/deploy/provider/workflow command passes 37/37 and the full repository gate
passes 65 test files / 764 tests plus 19 explicit goldens, architecture,
typecheck, build/artifact, lint, format and diff checks. The production artifact
is unchanged at 10 files/two assets, 1,977,623 bytes and SHA-256
`8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`.
The gate skipped dependency audit under its network-disabled policy; the
separately invoked `npm audit --json` reported zero vulnerabilities.

## V1 release evidence snapshot

The latest functional release evidence was refreshed through 2026-07-14 for
the source-backed Revision 274 root runtime. The complete functional suite and
post-Phase-4 read-only Darwin comparison pass locally. D-066 chooses
Cloudflare hosting/CSP/runtime; deployed Cloudflare evidence and a canonical
remote visual runner remain outside the current local evidence. The accepted V1 legacy
migration boundary is implemented; only explicitly deferred Planner/full-history
or broader migration decisions remain outside it.

| Check                                                       | Latest result                                                               | Notes and follow-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculation worker D-095                                    | `measurement, source and artifact pass`                                     | The production Worker entry completed two five-pair captures: 80 raw-sample tasks plus 80 concise-repeat tasks across typical/heavy Dense, Planner, Duel and Risk, with all clocks aligned. Warm request posting was 1.6-2.3 ms median for 0.90-1.09 MB JSON-shaped requests, startup/delivery 31.8-56.7 ms and total non-execution overhead about 34-59 ms. Dense retained the largest relative share at about 25% while staying below 141 ms median total; Planner, Risk and heavy Duel were execution-dominated. The focused calculation/performance gate passes 10/10, numeric audit 5,958/5,958 and full verify 64 files/761 tests plus 19 goldens and the 114-module architecture gate. The production artifact remains 10 files/2 assets, 1,977,623 bytes and SHA-256 `8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`. D-095 retains cancellable one-shot Workers and requires new low-end-device, production or repeated-task evidence before reopening persistence.                                                           |
| App composition root D-093 Phase 4                          | `source, numeric, functional and visual pass`                               | DOM-free app-shell/legacy owners and four pure shell components pass 12/12 new tests and 278/278 combined focused regressions, 5,958/5,958 numeric comparisons, 19/19 focused Chromium, 77/77 complete Chromium and 20/20 read-only Darwin scenarios against the existing 31 PNGs. Full verify passes 64 files/758 tests plus 19 goldens and the 114-module architecture gate. The 10-file artifact totals 1,977,328 bytes with SHA-256 `bea79ca8f4dd82815ea01397b54ae7987d130bdaa6acbf5c316ecbf7b2188379`; its 720,793 raw / 208,801 gzip entry remains inside D-094. No CSS, visual baseline, persistence schema or numeric contract changed; the Duel-only legacy readiness discrepancy remains characterized and unchanged.                                                                                                                                                                                                                                                                                                                           |
| Economy/Settings D-093 Phase 3G                             | `source, numeric, functional and visual pass`                               | Direct price-data/Settings view models and the pure three-mode pane pass 16/16 new tests and 132/132 combined focused regressions, 5,958/5,958 numeric comparisons, 8/8 focused Chromium, 77/77 complete Chromium and 20/20 read-only Darwin scenarios against the existing 31 PNGs. Full verify passes 61 files/746 tests plus 19 goldens and the 108-module architecture gate. The 10-file artifact totals 1,972,778 bytes with SHA-256 `1d0bb317b35fec093c7128559fbd0f39de17623d9799dbfe8a4bed65425118c0`; its 716,243 raw / 208,034 gzip entry remains inside D-094. The first visual start was sandbox-blocked; the approved localhost-only rerun passed without writing a baseline or permanent runner configuration.                                                                                                                                                                                                                                                                                                                               |
| Loot/Trip D-093 Phase 3F                                    | `source, numeric, functional and visual pass`                               | Direct simulation-input, Loot/Trip view-model and pure pane owners pass 238/238 focused tests, 5,958/5,958 numeric comparisons, 13/13 focused Chromium, 77/77 complete Chromium and 20/20 read-only Darwin visual scenarios against the existing 31 PNGs. Full verify passes 58 files/730 tests plus 19 goldens and the 105-module architecture gate. The 10-file artifact totals 1,966,525 bytes with SHA-256 `3c247248df68cf2dd14d33e1f256b464f06a9cf975cb8af4f7790e2057fa5e6c`; its 709,990 raw / 206,326 gzip entry remains inside D-094. No visual baseline or permanent runner configuration changed.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Planner D-093 Phase 3D                                      | `source, numeric, functional and visual pass`                               | Direct Planner view-model, controller and pane owners pass 129/129 focused tests, 16-case/32-comparison parity with zero open rows, 3/3 focused Chromium, 77/77 complete Chromium and 20/20 read-only Darwin visual scenarios against the existing 31 PNGs. Full verify passes 52 files/710 tests plus 19 goldens and the 97-module architecture gate. The 10-file artifact totals 1,962,374 bytes with SHA-256 `42a68f4e48d4999548010cbad8c291efe8786d4b9d08407193376b9bf5e4d2cc`; its 706,650 raw / 205,198 gzip entry remains inside D-094. No visual baseline or permanent runner configuration changed.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Compare/Duel D-093 Phase 3C                                 | `source, numeric and functional browser pass; fresh visual startup blocked` | Direct Compare/Duel view-models, feature controllers and pure panes pass 158/158 focused tests, 5,958/5,958 numeric comparisons, 9/9 focused Chromium and 77/77 complete Chromium. Full verify passes 704 tests plus 19 goldens and the 94-module architecture gate. The 10-file artifact totals 1,960,804 bytes with SHA-256 `8c7eceed5b825635db942e08e971c44663e9c4769d758c1d357acba4025fac9c`; its 705,080 raw / 204,250 gzip entry remains inside D-094. Both fresh visual-server attempts failed before browser execution with managed-sandbox `listen EPERM`; no baseline or permanent config changed.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-07-11 rewrite reliability audit                        | `pass`                                                                      | Final source passed 37 Vitest files/574 tests, 19/19 legacy golden tests, typecheck, ESLint, Prettier, `git diff --check`, generated runtime readiness with no blockers, Planner parity with 16 cases/32 comparisons and zero review/rewrite-gap rows, and `npm audit` with 0 vulnerabilities. The single-worker production-preview gate passed 63/63, including all 18 browser fixtures, strict setup/Duel recovery and the Compare/Planner/Duel Chromium Long Task budget. Production build and artifact validation passed with 8 files/2 assets, 1,692,036 bytes, 13 history snapshots and SHA-256 `f4eab3d3f19248eb6f9880485feecd295ee3b0ab4cd379c721a6d9c0ac3f7bb7`; the known main-chunk size advisory remains non-blocking. Static DOM/code-execution, secret, path, release-copy and raw-diagnostic searches found only the trusted legacy-reference sandbox, tests, dependencies and documented archived boundaries.                                                                                                                             |
| `npm ci && npm run verify` in detached fresh checkout       | `pass`                                                                      | Commit `43f8b5f` was tested without `.sources`, prior `node_modules`, `dist`, `.vite` or test output under Node 22.19.0/npm 10.9.3. Lockfile install added 237 packages; verify passed 523 unit tests, 19 explicit golden tests, typecheck, build/artifact, lint, format and diff checks. Build produced the expected artifact checksum from committed generated data, and a separate network-enabled `npm audit` reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run typecheck`                                         | `pass`                                                                      | The 2026-07-14 post-D-095 strict TypeScript build passed with `noUnusedLocals` and `noUnusedParameters`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run test`                                              | `pass`                                                                      | The post-D-095 full Vitest gate passed 64 files / 761 tests, including raw/measurement Worker compatibility, deterministic phase derivation and bounded cancellation/failure behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:golden`                                       | `pass`                                                                      | The post-D-095 golden fixture run passed all 19 tests unchanged. Fixture changes still require an accepted baseline decision before updating snapshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run build`                                             | `pass`                                                                      | The post-D-095 Vite build passed with only the known chunk-size warning. Artifact validation passed 10 files/2 assets, 1,977,623 bytes, 11 history snapshots and SHA-256 `8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`; entry JavaScript remains inside D-094 at 720,793 raw / 208,770 gzip bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cloudflare focused checks                                   | `repository pass; adopter upload gated`                                     | `npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts` passed 32/32. Evidence covers API-first routing, same-origin status/lookup, ephemeral client key, sanitized 404/500, security/no-store headers, static delegation, disabled observability/Logpush and exact Wrangler/static routing. D-067 leaves first bundle/version upload and deployed smoke to a future operator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Generated/runtime evidence                                  | `pass`                                                                      | Deterministic raw Revision 274 generation produced 390 items, 63 monsters with size, 94 numeric requirement rows and 25 typed conditional loot rows. Generated and legacy-reference readiness are `ready`, coverage has no blockers, source audit has zero unresolved identities, and focused parser/domain/Planner/UI checks pass. The committed report owns D-055/D-057/D-071/D-072 deltas and passes 11/11 representative cases with 22 advisory outliers across 189 evaluations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Source-backed ordinary-casket focused checks                | `pass`                                                                      | The focused parser/generator/Trip/UI suite passes 189/189, the full Vitest suite passes 606/606, legacy golden stays unchanged at 19/19, the current raw Revision 274 data-generator dry run passes without writes and the focused production-preview casket workflow passes 1/1. Domain coverage proves the exact 128-weight/210-coin formula, exact-before-alias-before-generated fallback, parent-price override, one parent slot, all three active monster rows and exact market dependency set. The numeric audit stays cross-path clean at 5,958 comparisons and classifies all three production changes as `source-backed-casket` (+25.87 GP/kill at the audited prices). Typecheck, build, lint, Prettier and diff checks pass.                                                                                                                                                                                                                                                                                                                   |
| Per-item price provenance/freshness focused checks          | `pass; unrelated full-browser failures remain`                              | D-085 passes 613/613 Vitest tests, 19/19 golden tests, typecheck, runtime readiness with 381/381 active metadata rows and no blocker, build, artifact validation, lint, format and diff checks. The artifact contains the required price sidecar and validates at 9 files/2 assets, 10 history snapshots and SHA-256 `0fddf34dfe36a7d824adf2332c7c53af3ca3bb3a32844e378bff224b53de06dc`. Focused scheduled/import/local-history and accepted D-084 numeric browser paths pass 5/5. The complete Playwright attempt passed 66/75 before the two now-verified D-084 expectations were updated; the remaining seven failures are existing topbar-status locator and permalink strict-locator mismatches outside this pricing change.                                                                                                                                                                                                                                                                                                                         |
| Dynamic loot market dependency focused checks               | `pass`                                                                      | D-086 focused market-sync/server/Trip/readiness tests pass 62/62. The generated audit covers 41 herb, 38 gem, three casket and three ultra-rare active rows with zero unrecognized tags, derives 49 unique calculation dependencies, reports 27 approved mappings and 22 missing mappings, and leaves numeric/golden behavior unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| High-impact dynamic-loot allowlist focused checks           | `pass`                                                                      | D-087 expands the allowlist from 80 to 92 source-reviewed rows. The twelve-row no-write live parser run reported eight updated plus four retained/skipped. After rebasing the latest scheduled snapshot, the full suite passes 614/614, legacy golden passes 19/19, and readiness is 39/49 mapped with exactly ten unsupported unidentified-herb gaps and no blocker. Six committed legacy-static price rows name their approved source slug without observation timestamps; typecheck, build, lint, format, diff and the nine-file/two-asset artifact check pass with 11 history snapshots at SHA-256 `b4f1813512d9f43e43a82e15eeffb9b31c42abbc149ff11119b8569cb728e83b`.                                                                                                                                                                                                                                                                                                                                                                                |
| Source-backed requirements/NPC size focused checks          | `pass`                                                                      | Focused parser/generator/runtime/domain/Planner/UI tests passed 190/190; refreshed Planner parity passed 13/13 with 16 cases/32 comparisons, zero review rows and zero rewrite gaps. Legacy golden stayed 19/19. Focused production-preview Planner/setup copy passed 2/2 and dragon-halberd size behavior 1/1. Full `npm run verify` passed 528 unit tests and artifact SHA-256 `acb785ea914a29cacbe33a8514d8a5e7be9b69c412aebbb64db75942610c2f8c`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Bounded whole-loadout optimizer focused checks              | `pass`                                                                      | `src/tests/ui-view-model.test.ts` passed 87/87 with deterministic improvement/no-regression, candidate-policy, cap, requirement and performance coverage. The focused production-preview apply/Undo smoke passed 1/1 after sandbox-external localhost execution and retained the active monster/style. Full `npm run verify` passed 543 unit tests, 19 golden tests, typecheck, build/artifact, lint, format and diff checks; the artifact SHA-256 is `b50e40eb6edc76f34922ed3c84783db7dffe6f91daf42c714bb7cc9805d67522`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Requirement-aware loadout optimizer focused checks          | `pass`                                                                      | D-088 focused view-model coverage passes 93/93 with checked-by-default generated numeric eligibility, explicit warning-only fallback, deterministic excluded-choice counting, unmet-current-baseline retention and existing cap/no-regression behavior. The production-preview eligibility/apply/Undo case passes 1/1 with unchanged target/style. Full `npm run verify` passes 616 unit tests, 19 goldens, typecheck, build/artifact, lint, format and diff checks; npm audit is skipped under the documented network-disabled policy. The artifact contains 9 files/2 assets, 1,930,006 bytes and SHA-256 `94cab4408737ec0f797e8051cf69f5bffe68f746bb97a83334b9b91bcb35fe6e`.                                                                                                                                                                                                                                                                                                                                                                           |
| Conditional-loot and manual-price focused checks            | `pass`                                                                      | D-089 Chromium coverage confirms the ordinary action table excludes an inactive clue row, the `Conditional drops` disclosure is collapsed by default and opening it shows the source chance, sanitized eligibility and locked Skip. D-090 state/local-health coverage passes 48/48; its Chromium workflow keeps a draft item-scoped, applies one Lobster price, exposes manual provenance, preserves it as inactive across a narrow base PriceSet, restores it on base reset, reloads persistence, resets it to the unchanged base and blocks a 513th row without throwing. Full `npm run verify` passes 621 unit tests, 19 goldens, typecheck, build/artifact, lint, format and diff checks. The artifact contains 9 files/2 assets, 1,937,694 bytes and SHA-256 `d40dc6bee4791be7bee37ac8536ca71f76a8c34d2be6e8bff112214d90490a01`; npm audit is skipped under the documented network-disabled policy. The read-only numeric audit passes 5,958 cross-path comparisons with zero mismatches and supports the current scheduled-price browser snapshots. |
| `npm run test:e2e -- --workers=1`                           | `pass`                                                                      | The complete 2026-07-14 post-Phase-4 gate passed 77/77 in Chromium. It includes compact-landscape and mobile containment, all workbench tabs, keyboard behavior and all simulation, storage, import, Planner, Compare, Duel, Loot, Trip, Economy, Risk and permalink workflows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run test:e2e:visual`                                   | `pass 20/20`                                                                | The post-Phase-4 read-only Darwin comparison passed 20/20 scenarios against the same 31 reviewed fixture-only PNGs through approved localhost-only execution. No baseline was written. `npm run test:e2e:visual:update` remains the only baseline-write command, and no CI runner or remote merge requirement is accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shareable setup focused checks                              | `unit and browser pass`                                                     | `npm run test -- src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts` passed 59/59, and the three permalink production-preview tests are included in the full 57/57 gate. Evidence covers strict bounded parsing, duplicate keys, game-data mismatch/unknown ids/stale loot, root/sub-path URL handling, clipboard failure, review-before-write, Load/Dismiss, complete Undo and preservation of unrelated/local price state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Duel monster matrix focused checks                          | `pass`                                                                      | `npm run test -- src/tests/ui-view-model.test.ts` passed 80/80, isolated `src/tests/ui-performance.test.ts` passed 3/3 with the 12-snapshot/819-cell matrix completing in about 2.5 seconds wall time, and the focused production-preview Playwright smoke passed 1/1. The full parallel Vitest gate also passed the CPU-time bound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Duel setup diff focused checks                              | `pass`                                                                      | `src/tests/ui-view-model.test.ts` passed 81/81, the focused production-preview Playwright workflow passed 1/1 after sandbox-external localhost execution, and `npm run verify` passed 524 unit tests, 19 golden tests plus the build/artifact gate. The artifact had 7 files, 2 assets and SHA-256 `19fc741807f55418f295a2412a14ce2200bdb7d3faa32d7a2a11425cf97d16f9`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Stats source-distribution focused checks                    | `pass`                                                                      | `src/tests/ui-view-model.test.ts` passed 81/81, focused special/cannon production-preview Playwright passed 2/2, and `npm run verify` passed 524 unit tests, 19 golden tests plus build/artifact, lint, format and diff checks. The artifact had 7 files, 2 assets and SHA-256 `27420966c85266d02317b045e1cbd79d49dc0029831d297297ac66cbf0fa9878`. The gate explicitly skipped npm audit in the network-disabled sandbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Accessibility/keyboard focused checks                       | `pass`                                                                      | The focused root/keyboard Playwright run passed 2/2 and the complete production-preview suite passed 58/58 in Chromium. Evidence covers first-focus DOM order, skip-link transfer, tab roles/selection/roving tabindex, arrow/Home/End activation, dynamic panel labelling, one Dense row Tab stop, focus-only row movement, computed outline visibility and Enter selection. Existing click/touch workflows all remain green. `npm run verify` also passed 524 unit and 19 golden tests plus lint/format/build/artifact/diff checks; artifact SHA-256 is `413c89e71d5faaa753ac503118744c447a61717a0c84d01164e161b0eaa39fb2`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                              | `pass`                                                                      | The 2026-07-14 post-Phase-4 full verification gate passes without ESLint errors or warnings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run format:check`                                      | `pass`                                                                      | The 2026-07-14 post-Phase-4 full verification gate passes Prettier for all owned source and documentation files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Goal 1/2 focused Playwright reruns                          | `pass, superseded by full baseline`                                         | Focused escalated localhost runs were used to isolate Combat/Stats/Special, Duel, Planner, Dense/Compare, Cannon, Trip, Loot and numeric-snapshot smoke paths during stabilization. The expanded full `npm run test:e2e` 57/57 pass now supersedes those focused runs and includes both the Duel matrix and all-fixture browser-display extensions. The older failure matrix below is retained only as historical triage evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Loot/Economy focused checks                                 | `pass with sandbox-limited browser smoke`                                   | On 2026-07-08, the Loot/Economy pass ran `npm run typecheck` and `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/data-economy.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts src/tests/price-import-notice.test.ts src/tests/market-server.test.ts src/tests/market-sync-items.test.ts src/tests/market-writer.test.ts src/tests/legacy-migration-*.test.ts src/tests/ui-view-model.test.ts`, passing 267 focused tests. The focused Loot/Economy Playwright smoke failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No source formulas, fixture outputs or Playwright numeric expectations changed, so `npm run test:golden` was not rerun for that documentation/status closure.                                                                                                                                     |
| Goal 3 numeric snapshot audit                               | `pass with sandbox-limited browser rerun`                                   | On 2026-07-08, focused numeric domain/view-model evidence passed: `npm run test -- src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/ui-view-model.test.ts src/tests/data-economy.test.ts` passed 173 tests, and `npm run test:golden` passed 19 tests. Focused numeric Playwright and full `npm run test:e2e` rerun attempts in the current managed sandbox both failed before browser execution with `listen EPERM 127.0.0.1:5173`; this is environment-only and does not supersede the earlier escalated 51/51 browser gate. No Playwright numeric expectations, source formulas or golden fixtures were changed.                                                                                                                                                                                                                                                                                                                                                                                 |
| Goal 4 release-gate refresh                                 | `pass with environment-only browser rerun limitation`                       | Goal 4 reran `npm run typecheck`, the focused Trip set `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/ui-adapters.test.ts src/tests/ui-view-model.test.ts src/tests/scaffold.test.ts src/tests/xp-parity.test.ts` with 178 passing tests, full `npm run test`, `npm run test:golden`, `npm run build`, `npm audit`, the static DOM/code-execution search, the static secrets search, the broader URL/API-copy search and the live-integration release-copy audit. All non-browser gates passed or had documented residual classifications. The only non-pass command was the focused Trip/Cannon Playwright smoke, which failed before browser execution with the managed-sandbox localhost `EPERM` limitation above. No source formulas, fixture outputs or Playwright numeric expectations changed.                                                                                                                                                                                                                                      |
| Goal 5 Planner focused checks                               | `pass with environment-only browser rerun limitation`                       | Goal 5 reran `npm run typecheck`, `npm run test -- src/tests/planner-domain.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/ui-view-model.test.ts src/tests/legacy-migration-*.test.ts` with 131 passing tests, `npm run test:golden` with 19 passing tests, `npm audit`, the static DOM/code-execution search, the static secrets search and a Planner/localStorage migration boundary search. Non-browser checks passed or had documented residual classifications. The focused Planner Playwright smoke `npm run test:e2e -- --workers=1 --grep "Planner"` failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No Planner source formulas, fixtures, persisted schema versions or Playwright numeric expectations changed.                                                                                                                          |
| Goal 6 legacy migration focused checks                      | `pass with environment-only browser rerun limitation`                       | Goal 6 reran `npm run typecheck` and `npm run test -- src/tests/legacy-migration-*.test.ts src/tests/local-state-health.test.ts src/tests/ui-adapters.test.ts src/tests/market-ui-state.test.ts src/tests/price-import-notice.test.ts src/tests/planner-ui-state.test.ts` with 126 passing tests. The focused Import/Keep/Clear/local-state Playwright smoke `npm run test:e2e -- --workers=1 -g "legacy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | local state"`failed before browser execution with`listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. Goal 6 changed documentation/status only: no source formulas, fixture outputs, persisted schema versions, localStorage key lists or Playwright numeric expectations changed, so `npm run test:golden` was not rerun. |
| D-042 Legacy Migration V1 custom/cannon import              | `unit/typecheck/focused browser pass`                                       | D-042 compatible nested `sim_input_v3.monsterSetups` and `sim_input_v3.cannonByMonster` import is implemented. `npm run test -- src/tests/legacy-migration-*.test.ts src/tests/ui-adapters.test.ts` passed 85 tests in the implementation pass; the current verification reran `npm run test -- src/tests/legacy-migration-*.test.ts` with 37 passing tests and `npm run typecheck` passed. The focused Playwright command suggested by the spec, `npm run test:e2e -- --grep "legacy migration"`, now starts under localhost escalation but selects no tests because current test titles do not contain that phrase. The equivalent current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                                                                                                                                                                                                            | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` passed 3/3 tests in Chromium and covers compatible nested custom setup/cannon import plus Import/Keep/Clear boundaries. |
| Legacy Migration V1 UX/status closure                       | `unit/typecheck/focused browser pass`                                       | Goal 3 closed the user-facing review copy for the accepted V1 boundary. The Settings notice now shows a metadata-only outcome summary for importable, skipped and review-only areas, makes D-048 `sim_planner_v1` and D-049 full legacy price history explicit review-only/not-migrated decisions, and keeps Import/Keep/Clear status copy separate. `npm run test -- src/tests/legacy-migration-*.test.ts` passed 37 tests and `npm run typecheck` passed. The Playwright scaffold source checks the outcome copy, Import/Keep/Clear status messages and absence of raw planner/history payload sentinels. The spec-suggested grep selected no tests under localhost escalation, so the current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                                                                                                                                                        | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` was run instead and passed 3/3 tests in Chromium.                                                                       |
| Goal 7 release-gate and status check                        | `historical core pass; browser refresh pending`                             | Goal 7 reran the then-current core release commands plus `npm audit`, static DOM/code-execution search, static secrets search, broader URL/API-copy search and live-integration release-copy audit. Non-browser checks passed or had documented residual classifications. The 2026-07-09 core refresh supersedes this row for non-browser gates; a localhost-capable browser smoke refresh is still needed for fresh browser evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-09 generated-data/backlog maintenance focused check | `focused pass, superseded by same-day core refresh for non-browser gates`   | The generated-data/backlog pass changed generator report copy, generated-data review docs, backlog status, idea-inbox maintenance and the fixture-owned representative calculation-impact suite, expanding it from the original melee/ranged/magic fixture cases to 9 fixture-owned cases covering cannon, recoil, alch-policy, loot-heavy/nested-loot, high-defence-pressure and low-level paths too. `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts` passed 57 tests, `npm run typecheck` passed and `git diff --check` passed. The later 2026-07-09 core refresh reran full unit, typecheck, golden, build, dependency audit and static release/security searches, but still does not claim fresh browser evidence.                                                                                                                                                                                                                                                                                                  |
| Legacy-derived static runtime bridge focused check          | `historical pass; superseded by D-059`                                      | This pass established the static snapshot and freshness gate while D-054 still kept it as root runtime truth. D-059 later superseded that bootstrap boundary after raw source coverage and impact evidence closed. The artifacts remain useful regression/reference evidence under `npm run runtime:write-legacy-derived -- --check`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Source-backed runtime coverage-plan focused check           | `historical focused pass; superseded by completed coverage`                 | This pass added complete `missingIds`/`extraIds` arrays and `npm run runtime:coverage-plan` while source coverage was incomplete. The same command now reports zero blocking gaps for the active generated runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Runtime monster combat-stat source-slice batch              | `historical focused pass; superseded by raw generator`                      | This normalized fixture batch introduced the combat-stat gate before raw loot integration. The active raw generator now supplies combat and 63/63 loot tables, including typed conditional rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Runtime combat catalog source-slice batch                   | `historical focused pass; superseded by raw generator`                      | This normalized fixture batch introduced weapon, ammo, spell and equipment field gates. The active raw generator now supplies all expected combat-catalog identities and accepted D-056/D-057 source deltas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Runtime item and PriceSet coverage batch                    | `historical focused pass; superseded by D-058/D-059/D-071`                  | This normalized fixture batch introduced item and PriceSet gates. The active raw snapshot now uses distinct cut/uncut identities, 63 NPC sizes and 94 requirement rows, passes 11/11 representative cases, records 22 outliers in 189 evaluations and is root runtime under D-059.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm audit`                                                 | `pass`                                                                      | 2026-07-10 reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check`                                          | `pass`                                                                      | Passed after this documentation refresh.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Static DOM/code execution search                            | `pass with classified residual`                                             | Found trusted bundled legacy source execution `new Function` use in `src/adapters/legacy-runtime/source-bootstrap.ts` and `scripts/report-generated-runtime-readiness.ts`; both execute repository-owned legacy source files for reference/readiness/regeneration, not user input. The root app bootstrap uses `src/adapters/generated` and committed validated JSON instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Static secrets search                                       | `pass with false positives`                                                 | Found item/package/doc/test text such as `token`, `js-tokens`, `css-tokenizer`, local-state-health fixture text and a URL password-rejection guard, with no real API key, secret, bearer token, password or private key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Release-copy audit                                          | `pass with classified residuals`                                            | Legacy `run_sim.py`, `/api/prices`, `/api/scrape` and legacy `/api/hiscores` hits remain archived evidence or documentation/history. Production rewrite paths use typed same-origin status/sync/lookup contracts and service-aware copy. The broader URL/API-copy audit also classifies CDN/Babel, `markets.lostcity.rs`, localhost and test URLs as archived legacy evidence, adapter/test contracts or documentation/history rather than production rewrite UI copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Repository-local visual regression                          | `pass on Darwin`                                                            | The current 77/77 functional gate remains the workflow/numeric owner. The separate [visual regression suite](../technical/visual-regression-spec.md) passed 20/20 against 31 reviewed Darwin baselines with deterministic state and explicit update policy. Remote merge-blocking status and a canonical CI platform baseline still need a separate CI decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Live upstream integration calls                             | `opt-in pass; default tests mocked`                                         | Default tests stay mocked. Separate sanitized 2026-07-10 checks mapped seven combat skills from the accepted Hiscores provider with zero warnings and completed the 80-mapping market dry-run with 69 updated plus 11 retained/skipped rows and no writes. No raw provider/market payload or username was committed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Goal 3 numeric snapshot audit

Status date: 2026-07-10. This audit separates browser-rendered numeric snapshot
evidence from the historical UI-flow failure matrix. No active Playwright
numeric failure remains: the current production-preview `npm run test:e2e` gate
passes 57/57 against the source-backed runtime. Older localhost `EPERM`, timeout
and stale-locator rows below remain historical triage evidence only.

Current numeric failure classification summary:

| Class              |              Current count | Notes                                                                                                                                                                |
| ------------------ | -------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regression`       |                          0 | No current numeric mismatch or calculation regression is evidenced.                                                                                                  |
| `stale-test`       |                          0 | No numeric expectation was found to be stale in the current passing gate.                                                                                            |
| `timing/flaky`     |    0 active / 2 historical | The superseded dense release-path and loot/trip numeric rows timed out before numeric assertions and are historical only after the later passing full browser gates. |
| `environment-only` | 1 current rerun limitation | Focused numeric Playwright and full e2e rerun attempts failed to start Vite with `listen EPERM 127.0.0.1:5173` in the managed sandbox.                               |
| `out-of-scope`     |                          0 | No numeric failure is removed from the gate as out of scope.                                                                                                         |

Numeric-path matrix:

| Test or path                                                                                                      | Feature area                                               | Current symptom                                                                                                                                              | Evidence                                                                                                      | Class                                              | Recommended decision                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `matches browser-rendered dense numeric snapshots`                                                                | Dense / metric strip / Cannon output                       | No current failure in the latest successful gate.                                                                                                            | Covered by the expanded 57/57 Playwright pass and all-fixture source-backed metric comparison.                | none active                                        | Keep expectation changes tied to source-backed view-model or parity evidence. |
| `matches release-path dense numeric snapshots`                                                                    | Dense release path / metric strip                          | No current failure in the latest successful gate. Historical failure was a timeout before numeric assertions while setting up the large multi-scenario path. | Expanded 57/57 Playwright pass plus Goal 3 focused domain/view-model and golden pass.                         | historical `timing/flaky`                          | Do not treat the historical timeout as a numeric delta.                       |
| `matches browser-rendered numeric snapshots for loot action and trip overrides`                                   | Loot action override / Trip manual controls / metric strip | No current failure in the latest successful gate. Historical failure timed out while editing `Recoil rings`; no numeric mismatch was reported.               | Expanded 57/57 Playwright pass plus Goal 3 focused trip/loot, XP, UI view-model and golden pass.              | historical `timing/flaky`                          | Keep expectation changes tied to source-backed view-model or parity evidence. |
| `matches browser-rendered numeric snapshots for imported price sets`                                              | PriceSet import / money metrics                            | No current failure in the latest successful gate.                                                                                                            | Covered by the expanded 57/57 Playwright pass and `src/tests/data-economy.test.ts` in the Goal 3 focused run. | none active                                        | Live market upstream parity remains outside automated browser tests.          |
| `enables cannon for the selected monster and shows cannon rates` and Cannon numeric output inside dense snapshots | Cannon / Trip sparse link / metric strip                   | No current failure in the latest successful gate. Historical Cannon row was a tab actionability timeout after reload, not a numeric mismatch.                | Expanded 57/57 Playwright pass plus Goal 3 focused trip/loot, XP and UI view-model pass.                      | none active; related historical row `timing/flaky` | Keep current Cannon output expectations.                                      |

Expectation and baseline policy for this audit:

- No Playwright numeric expectation was updated.
- No source calculation formula was changed.
- No legacy golden fixture was regenerated or edited.
- The accepted ring-of-recoil XP attribution delta remains the existing D-031
  line; Goal 3 did not add a new intentional numeric delta.
- The accepted Dense/Compare browser numeric scope remains D-032. Full
  all-fixture browser-display parity and full visual regression are not release
  requirements without a future decision.

## Superseded Playwright smoke failure matrix

Status date: 2026-07-08. This matrix records the pre-stabilization default
`npm run test:e2e` failure triage for the Vite/React rewrite. It is retained as
release-evidence history only. The latest browser-executed default gate is the
later full `npm run test:e2e` pass above: 51 passed out of 51 tests after
localhost sandbox escalation. The later managed-sandbox browser refresh attempt
could not refresh that browser gate, and the 2026-07-09 core refresh did not
rerun browser smoke.

Classification meanings:

- `regression`: the failing assertion points at a user-visible workflow or
  persisted-state contract that appears wrong or incomplete.
- `stale-test`: the tested behavior appears present, but the assertion is
  targeting it in a way that no longer matches the current DOM/accessibility
  shape.
- `timing/flaky`: the failure is dominated by actionability, locator stability,
  clock/debounce timing or a mismatch between the assertion log and the final
  error-context DOM.
- `environment-only`: caused by the managed sandbox or local browser/runtime
  environment rather than the app. The pre-escalation `listen EPERM` failure is
  environment-only; none of the 19 escalated browser failures are classified
  this way.
- `out-of-scope`: the test asserts behavior outside the accepted current
  release gate. No current failure is classified this way without a future
  explicit decision.

The recommendations in the rows below are the original triage decisions from
the superseded failing run. They are not the current release-gate state after
the later 51/51 default Playwright pass.

| Test                                                                             | Feature area                         | Symptom                                                                                                                                                        | Likely cause                                                                                                                                                                            | Class                                                 | Recommended release-gate decision                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loads the dense combat spreadsheet root`                                        | Economy / market copy                | Strict-mode failure: the scheduled market refresh copy resolves to two elements inside `Market price data`.                                                    | The production copy is present twice, once as neutral paragraph copy and once as a status message. The locator is too broad for current UI.                                             | `stale-test`                                          | Do not treat as a product blocker after narrowing the assertion; keep the overall e2e gate failed until the test is updated or explicitly reclassified. |
| `places MonsterCard after the active pane on mobile`                             | Mobile shell / MonsterCard           | `.workbench-shell > *` returned an empty array even though the error context shows `Workbench shell`, `Player sidebar`, `Workbench center` and `Monster card`. | The test evaluates a CSS selector immediately after navigation without first waiting for the shell, while the accessible layout is present in the failure context.                      | `timing/flaky`                                        | Keep as a browser-smoke blocker until a focused rerun or test hardening proves mobile ordering reliably passes.                                         |
| `recomputes the Planner tab workflow from visible planner controls`              | Planner                              | Timeout while checking `Lock Attack`; the checkbox resolves but the action never completes.                                                                    | Planner UI is present, but the control is not actionably stable during the test window, likely due render/workload timing or locator actionability.                                     | `timing/flaky`                                        | Keep as a release gate failure for the visible Planner workflow until focused Planner smoke is stable.                                                  |
| `uses the Duel tab to snapshot rename load delete and persist setup comparisons` | Duel snapshots                       | After Undo, the undo status says the snapshot was restored, but the rename control for `Melee saved` is not visible.                                           | Likely Duel undo/table refresh regression, or a stale table reference after restore. The current context shows only the live setup row.                                                 | `regression`                                          | Release-blocking for the Duel workflow unless a focused rerun proves it is flaky and not a state bug.                                                   |
| `restores per-combat-style loadout edits when switching styles`                  | Basic combat setup / per-style state | Ranged `BOOST` is expected to restore to `ranging`, but the compact selector was empty in the historical full default run.                                     | Likely per-style boost restore or compact boost synchronization regression in that run; the focused Goal 1 rerun passed after the combat-style tab routing fix.                         | `regression` in historical run; focused rerun `pass`  | Remove from the remaining likely-regression list after the next full default gate confirms the focused result.                                          |
| `edits combat equipment panes and persists style-specific selections`            | Equipment loadout persistence        | Timeout clicking the `Melee` tab after reload; the tab resolves but does not become actionably stable.                                                         | Reload/tab actionability timing issue is more evident than a numeric or persisted-value mismatch.                                                                                       | `timing/flaky`                                        | Keep as a smoke-gate failure; confirm with focused rerun before classifying as product regression.                                                      |
| `creates, restores and removes monster-specific custom setups`                   | Custom setup snapshots               | After Undo for removed custom setup, `Setup context` does not contain `Custom setup`.                                                                          | Likely custom setup undo or setup-context refresh regression.                                                                                                                           | `regression`                                          | Release-blocking for monster-specific setup workflow until fixed or reclassified with evidence.                                                         |
| `selects special attacks and shows special metrics`                              | Special attacks                      | Assertion times out on DBA boost explanatory copy, while the error context shows the same copy inside `Special attack` in the last full default run.           | The expected UI exists in the final context; the focused Goal 1 rerun passed after tab-route and locator hardening, so this is not treated as missing visible special-attack behavior.  | `timing/flaky` in last full run; focused rerun `pass` | Keep the full smoke gate failed until rerun, but do not treat this row as a remaining Special attacks product blocker.                                  |
| `shows dense compare calculation freshness while rows catch up`                  | Dense compare freshness              | Status changes to `Updating`, but the panel text still reads `current loadout` and not `rows may reflect previous loadout` in the last full default run.       | The focused Goal 2 rerun passed after narrowing the smoke expectation to the status pill and live-row interaction, so this is not treated as a remaining Dense Compare product blocker. | `regression` in last full run; focused rerun `pass`   | Remove from the remaining likely-regression list after the next full default gate confirms the focused result.                                          |
| `matches release-path dense numeric snapshots`                                   | Dense numeric release path           | Test hits its 60s timeout and the page closes while selecting Loot high-alch settings; no numeric mismatch is reported.                                        | Large multi-scenario test is timing out before the assertion payload, likely due actionability/performance rather than a proven numeric delta.                                          | `timing/flaky`                                        | Keep the smoke gate failed, but do not update numeric snapshots from this result. Split or harden before treating it as a calculation regression.       |
| `enables cannon for the selected monster and shows cannon rates`                 | Cannon                               | After reload, clicking the `Cannon` tab times out while waiting for the tab to be stable.                                                                      | The Cannon state appears active in the error context, but the tab click after reload is not actionably stable.                                                                          | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Cannon smoke should determine whether there is a reload/state regression.                                         |
| `updates trip survival controls and keeps the trip summary visible`              | Trip survival summary                | Assertion times out looking for `Antifire`, while the error context shows `Antifire` and `Antipoison` in the Trip summary.                                     | Locator/timing mismatch; the expected summary state is present in the final browser context.                                                                                            | `timing/flaky`                                        | Keep as a smoke-gate failure until the Trip summary locator or timing is hardened.                                                                      |
| `updates manual food controls and recoil ring count`                             | Trip food / recoil persistence       | After reload, `Food mode` is expected as `manual`; the error context shows Manual food and `Recoil rings` value `6`.                                           | Final DOM contains the expected controls and values, pointing to locator/timing mismatch rather than proven app failure.                                                                | `timing/flaky`                                        | Keep as a smoke-gate failure; focused rerun should decide if the persistence path is actually stable.                                                   |
| `updates trip food, banking and inventory reserve controls across styles`        | Trip controls across styles          | Test hits its 60s timeout and page closes while switching back to Trip after Magic.                                                                            | Long cross-style scenario exceeded the test window; no specific value mismatch was captured.                                                                                            | `timing/flaky`                                        | Keep as a smoke-gate failure; split or focus before treating as product regression.                                                                     |
| `updates trip potion carry controls and grouped potion summary`                  | Trip potion carry                    | Visible summary reaches `6 doses/type`, but `waitForFunction` never observes the expected persisted setup substrings.                                          | Likely persistence regression or stale persistence-shape expectation for single-dose potion state.                                                                                      | `regression`                                          | Release-blocking until the persisted contract is verified and either code or test expectation is corrected with evidence.                               |
| `updates prayer restore detail controls and keeps the trip summary visible`      | Trip prayer restore                  | After reload, clicking `Trip` times out while the tab resolves but does not stabilize.                                                                         | Reload/tab actionability timing dominates; no persisted-value mismatch is reached.                                                                                                      | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Trip prayer smoke should decide whether persistence is actually broken.                                           |
| `updates per-monster loot settings and keeps them after reload`                  | Loot/economy settings persistence    | After reload and target selection, clicking `Loot` times out; context shows Green Dragon markers in Compare.                                                   | The test does not reach value assertions; tab actionability after reload is the immediate failure.                                                                                      | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Loot settings smoke should confirm whether state reload works.                                                    |
| `resets one Active modifiers loot row while preserving neighboring loot state`   | Active assumptions / Loot reset      | After resetting loot settings, assertion says `Active assumptions` is empty, but the error context shows `Loot action overrides` and no `Loot settings`.       | Final UI matches the intended post-reset state, so the failure looks like locator/timing mismatch.                                                                                      | `timing/flaky`                                        | Recommended reclassification to test-hardening work after focused confirmation; keep the full e2e gate failed meanwhile.                                |
| `matches browser-rendered numeric snapshots for loot action and trip overrides`  | Loot / Trip numeric snapshots        | Timeout filling `Recoil rings`, while the error context shows the input at value `6`.                                                                          | Actionability/timing issue before numeric assertions; no snapshot value mismatch is reported.                                                                                           | `timing/flaky`                                        | Keep as a smoke-gate failure; do not update snapshots from this result.                                                                                 |

Summary for the superseded full default run: 5 likely `regression` failures, 1 `stale-test`, 13
`timing/flaky`, 0 escalated-browser `environment-only` failures and 0
`out-of-scope` failures. The pre-escalation `listen EPERM` failure remains an
environment-only managed-sandbox limitation and is not counted in the 19 browser
failures. These rows have been superseded by the later 51/51 default Playwright
pass and are no longer active release blockers.

Focused Goal 1 and Goal 2 follow-ups on 2026-07-08 isolated the failing browser
paths before the final full-suite pass. The final default `npm run test:e2e`
rerun replaces the matrix as current release evidence.

Security and privacy notes for this run: tests used localhost Vite plus mocked
or same-origin API paths. The market source URL appears only as test fixture
metadata. No live hiscores lookup, live market upstream call, raw browser
storage payload, user player name, secret, token or machine-specific path is
recorded in this matrix. Tenant risk is not applicable because this checkout has
no tenant model.

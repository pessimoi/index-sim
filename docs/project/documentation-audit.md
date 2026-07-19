# Repository documentation audit

## Current audit window: 2026-07-19

- Status: complete with documented parallel-source deferrals
- Scope: repository-wide documentation truth audit against the current code,
  tests, scripts, configuration and committed data
- Mutation boundary: documentation, backlog, decision-index and audit-log files
  only; production and test sources stay read-only
- Living truth policy: the owner map in `AGENTS.md` and
  [the documentation map](../README.md) decides where durable corrections
  belong; this section records evidence and coverage rather than duplicating
  those owners

### Protected worktree baseline

The audit started from `git status --short` with pre-existing changes in these
areas. They are treated as user or parallel-work changes and must not be
overwritten or reverted:

- documentation owners and indexes: `docs/README.md`,
  `docs/product/feature-inventory.md`, `docs/project/backlog.md`,
  `docs/project/testing-evidence.md`, `docs/technical/README.md`,
  `docs/technical/architecture.md`, `docs/technical/testing.md` and
  `docs/technical/testing/ui-state-and-browser.md`;
- Planner/Risk/Worker specifications:
  `docs/technical/calculation-worker-retention-spec.md`,
  `docs/technical/planner-pane-refactor-spec.md`,
  `docs/technical/planner-xp-target-integrity-spec.md`,
  `docs/technical/risk-pane-refactor-spec.md` and
  `docs/technical/risk-variability-spec.md`;
- rewrite source and focused tests under the changed `src/app` controllers,
  Planner/Risk/Compare panes and view models, startup/recovery composition,
  styles and their focused unit/Playwright suites; and
- six untracked specifications plus the untracked application-recovery,
  calculation-lifecycle and Error Boundary sources/tests listed by the initial
  status.

The changed source/test areas are deferred until the worktree stabilizes.
Unchanged data, domain, adapter, server, script, build/deployment and project
memory areas remain independently auditable. A later documentation edit may
touch one of the pre-existing documentation files only as a narrow additive
correction after its existing diff is inspected and preserved.

### Evidence ledger

| Slice                                              | Checked sources                                                                                                                                                 | Verified boundary or finding                                                                                                                                                                                                                                        | Documentation action                                                                                                                       | Validation                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation structure and command/link integrity | `AGENTS.md`, root/section READMEs, all 105 Markdown files, `package.json`                                                                                       | 99 files live under `docs/`; all local Markdown links resolve; all 38 distinct documented `npm run` commands exist                                                                                                                                                  | Audit in progress; ownership and duplicate-truth review continues                                                                          | Repository-local link and package-script reference scans passed                                                                                                                                                                                             |
| Repository bootstrap and toolchain                 | root `README.md`, `.nvmrc`, `package.json`, lockfile, Vite/Vitest/Playwright/TypeScript/ESLint/Prettier configuration and startup/release scripts               | Node 22/npm 10, `dev:checked`, browser-independent raw `dev`, authoritative `verify` and Cloudflare commands agree across code and documentation                                                                                                                    | Retained the root README as the concise onboarding owner; no duplicate command table added                                                 | Static command/config comparison passed                                                                                                                                                                                                                     |
| Committed market and generated-data identity       | `prices.json`, `price-provenance.json`, `alch.json`, `price-history.json`, `src/data/generated/game-data.json`, `src/data/generated/source-pin.json`            | Price capture is 2026-07-16T16:36:55.000Z; provenance has 139 item rows; the committed generated snapshot has 390 items and 63 monsters and carries Revision 274 context                                                                                            | Current owner review continues in architecture, operations and runtime/data testing docs                                                   | All inspected JSON parsed                                                                                                                                                                                                                                   |
| Generated runtime and source coverage              | generated snapshot/source pin, raw LostCity parsers, runtime readiness/coverage reports, revision-impact report, NPC attack audit and numeric audit             | Revision 274 source context agrees; runtime readiness has zero blockers; 63/63 runtime monsters resolve loot, 94 item requirement rows exist and 5,958/5,958 numeric comparisons match                                                                              | Corrected stale rewrite completion/status wording and retained generated/runtime owners                                                    | `runtime:readiness`, `runtime:coverage-plan`, `npc:attack-audit`, `numeric:audit` and `data:source-audit` passed; read-only `data:source-impact` exited successfully and, by design, left two raw magic deltas as `needs-review` rather than accepting them |
| Domain and legacy calculation boundary             | `src/domain`, `engine.js`, `equipment.js`, `gamedata.js`, `trip.js`, `market.js`, `planner-core.js` and focused tests                                           | Domain has no React/browser/network global dependency; legacy files remain reference/golden inputs; composed simulation, Planner, Trip and Risk focused behavior passed                                                                                             | Corrected implemented-vs-proposed wording in rewrite, incoming-damage and related clean specifications                                     | Seven `node --check` checks and 8 focused test files / 104 tests passed                                                                                                                                                                                     |
| Planner and generated audit reports                | Planner parity generator/domain tests, `planner-parity/current.md`, `numeric-user-path-audit.md`, `npc-attack-source-audit.md` and `revision-impact/current.md` | Generated reports are dated evidence with distinct interpretation boundaries; Planner reports 16 cases/32 comparisons with no review or rewrite gaps                                                                                                                | Kept generated reports out of living architecture and documented their dated-evidence role in indexes                                      | `planner:parity` passed 2 files / 21 tests and reported zero open comparison rows                                                                                                                                                                           |
| Deployment and static-market boundary              | Vite/Wrangler/Worker/header config, deploy scripts, disabled workflow template and writer sources/tests                                                         | Root Cloudflare Worker + Static Assets package exists; all four static market JSON files are emitted; writer changes only prices/provenance/history; no active Actions workflow exists                                                                              | Corrected operations artifact lists, disabled-schedule wording and security-audit follow-up                                                | 4 focused deploy/config test files / 27 tests passed                                                                                                                                                                                                        |
| Persistence, migration and live integrations       | storage/state modules outside parallel UI work, browser adapters, server handlers/providers, same-origin middleware and focused tests                           | Eleven versioned rewrite-owned health descriptors; bounded/schema-validated storage; compatible exact-key legacy migration; same-origin Hiscores/market adapters; disabled default market provider; Hiscores source/runtime implemented with global enforcement off | Corrected stale production-runtime claim, pre-split migration wording and D-099 workflow path/status                                       | 19 focused test files / 196 tests passed                                                                                                                                                                                                                    |
| GitHub workflow boundary                           | `.github/workflows`, `.github/disabled-workflows/update-market-prices.yml`                                                                                      | No active workflow file exists; the retained hardened market workflow is outside the active directory                                                                                                                                                               | Corrected the security audit to separate its 2026-07-14 evidence from the D-099 follow-up                                                  | Read-only path inventory and `workflow-security` tests passed                                                                                                                                                                                               |
| Project memory and historical evidence             | roadmap, backlog, decisions, idea inbox, project indexes, dated architecture/security/code/maintainability audits and root audit snapshots                      | Living current state, accepted decisions, implementable work, speculative ideas and dated snapshots have separate owners; root audits are explicitly non-living evidence                                                                                            | Corrected roadmap/decision statuses, historical delivery labels and audit-index wording; added one documentation-maintenance backlog owner | Ownership and local-link review passed                                                                                                                                                                                                                      |
| Dependency/security freshness                      | `package-lock.json`, current dependency tree and dated security evidence                                                                                        | The security audit's 353-dependency result is a 2026-07-14 snapshot, not a living count; current lockfile audit found no reported vulnerability                                                                                                                     | Reworded the dated security claim and kept the new result in this audit log instead of duplicating it into living architecture             | `npm audit --audit-level=high` passed with 0 reported vulnerabilities                                                                                                                                                                                       |
| Implemented-spec status semantics                  | technical index, implemented refactor/spec files, backlog and decision index                                                                                    | Dated implementation specs retain activation-time phase lists, measurements and old “next phase” questions; these are not current backlog unless reopened by a living owner                                                                                         | Added one central interpretation rule to the technical index rather than rewriting or duplicating every historical implementation record   | Status/index cross-check completed                                                                                                                                                                                                                          |

### Deferred areas

- The active UI calculation lifecycle, Planner, Risk, startup/recovery and Error
  Boundary claims are not independently certified by this audit while their
  implementation and focused tests are already modified or untracked in the
  protected baseline. Their pre-existing documentation changes are preserved.
- Active-setup reset source, shell, tests and specification appeared after the
  baseline alongside further workbench/UI test edits. That slice is likewise
  deferred as parallel work rather than audited against a moving source. Its
  specification, feature-inventory row and backlog card still say
  “not implemented”/`Specced`; this audit does not choose the final status while
  the implementation is arriving concurrently.
- Current product/UI inventory, `ui-parity-spec.md`, the UI portions of
  `rewrite-spec.md` and `rewrite-parity-report.md`, App composition/pane
  refactor evidence, `architecture.md` UI module/count paragraphs and the main
  plus UI/browser testing guides are deferred where they depend on the same
  changed `src/app` and focused-test surface. Narrow independent corrections to
  D-099, artifact ownership and historical-evidence semantics were still made
  after preserving their pre-existing diffs.
- The three other pending user-work specifications—contextual item-price
  correction, Workspace backup/restore and user-facing language/units—remain
  `Specced`/pending in the backlog and do not have a completed clean source
  implementation in this audit window. Their parallel-authored text was not
  rewritten.

### Open audit questions

- Resolved in the server/deploy slice: the repository owns narrow same-origin
  handlers, Vite middleware and a Cloudflare Worker. What is absent is an active
  Actions workflow, a general merge CI owner, a stateful simulation backend, a
  general application database and `run_sim.py`; architecture wording now uses
  those precise boundaries instead of saying backend source is missing.
- The earlier 2026-07-13 audit's file/test/scenario counts are historical by
  design. Current counts will be recorded only as dated evidence; living docs
  must not depend on them as stable constants.
- The living testing topic guides still contain dated counts, hashes and run
  outcomes that duplicate `testing-evidence.md`. A documentation-maintenance
  backlog item now owns that consolidation; this audit does not rewrite the
  parallel-modified testing owners while their source area is moving.

### Validation summary

Checks completed during this audit window:

- all 105 Markdown files passed the repository-local relative-link scan;
- all 38 distinct documented `npm run` command names exist in `package.json`;
- all four market JSON files and the generated snapshot/source pin parse, and
  their capture/revision contexts agree;
- `node --check` passed for the seven retained root JavaScript calculation/data
  files;
- generated runtime readiness, coverage plan, NPC attack audit, numeric audit,
  raw source coverage and Planner parity completed with the interpretation
  boundaries recorded in the ledger;
- focused data/generator/runtime tests passed 8 files / 165 tests;
- focused domain/legacy calculation tests passed 8 files / 104 tests;
- focused persistence/migration/live-integration tests passed 19 files / 196
  tests;
- focused deployment/configuration tests passed 4 files / 27 tests;
- Planner parity passed 2 files / 21 tests and reported 16 cases / 32
  comparisons with no review or rewrite gaps;
- current lockfile `npm audit --audit-level=high` reported 0 vulnerabilities;
- `npm run typecheck` passed;
- `npm run architecture:check` passed against the concurrently growing graph at
  137 source modules / 122 client-reachable modules, eight documented external
  entrypoints, no cycles and no exceptions;
- the first full `npm run verify` pass reached 88 files / 877 tests, 19 goldens,
  production build and the validated 10-file artifact before stopping only at
  document formatting; the eight reported Markdown files were formatted
  mechanically, after which repository-wide `npm run format:check` passed; and
- `git diff --check` and `git diff --cached --check` pass.

The authoritative full-gate rerun then passed end to end: 88 Vitest files / 877
tests, 19 explicit goldens, typecheck, the 137/122 architecture graph,
production build, the 10-file/two-asset artifact contract, lint, Prettier and
diff checks. Its network-disabled policy skipped the embedded dependency audit;
the separately completed current `npm audit --audit-level=high` supplies that
read-only evidence. No browser or visual suite was rerun because this audit did
not change product behavior and their active UI source/test owners were part of
the protected moving worktree.

---

> Historical evidence snapshot from an earlier 2026-07-13 worktree. Its file,
> module and test counts and its then-failing typecheck note are not current.
> See [the current architecture](../technical/architecture.md), [testing
> summary](../technical/testing.md) and [latest repository-wide architecture
> audit](../../ARCHITECTURE_AUDIT.md) for living/current facts. The detailed
> ledger below is preserved as evidence of that audit window.

- Status: completed against the current worktree
- Audit date: 2026-07-13
- Scope: every repository file returned by `rg --files --hidden -g '!.git' -g '!node_modules'`
- Final inventory: 305 files, including this report and the architecture-check source/test added during the audit window
- Truth policy: runtime code and committed data first, then the owning living documents defined in `AGENTS.md`

## Outcome

The production architecture, current feature state and validation surface are
substantially documented. The audit found and corrected stale boundaries left
behind by the rapid D-069-D-090 implementation sequence. The most important
corrections were:

- the production app is the module-based Vite rewrite; only the archived legacy
  runtime is script-order and `window.*` driven;
- the repository owns framework-neutral Hiscores/market handlers, Vite
  middleware and a Cloudflare Worker adapter even though it has no stateful
  simulation backend, auth service or general application database; D-097 later
  added one disabled aggregate-only rate-limit Durable Object;
- the active market artifact is a three-file
  `prices.json`/`price-provenance.json`/`price-history.json` logical set, not the
  older two-file writer contract;
- the root runtime consumes the committed generated Revision 274 snapshot, not
  the legacy sandbox/static bridge;
- implemented accessibility, Duel diff, conditional loot, requirement, Stats,
  optimizer, Risk and incoming-damage specifications no longer present
  themselves as merely proposed or awaiting implementation;
- the functional browser inventory is 76 scenarios, and the Darwin visual
  inventory is 20 scenarios producing 31 reviewed PNG baselines;
- repository-local all-fixture and visual evidence exists; only broader
  pane-detail coverage and promotion to a canonical remote merge gate remain
  later decisions; and
- the committed price snapshot capture time is 2026-07-12T03:54:50.000Z, so
  human-facing copy no longer reports the older 3 July date.

No production source, generated data, fixture, baseline image or accepted
numeric result was changed by this audit.

## File-by-file coverage ledger

Every inventory row was assigned to exactly one area below. Text source was
checked for entrypoint/import/export or global ownership, runtime boundary,
documented role and stale path/command claims. JSON was parsed and its top-level
contract compared with schemas/adapters. PNG baselines were checked by filename
inventory and scenario ownership rather than treated as text. Generated reports
and historical audit snapshots were checked for classification and links, but
their historical evidence was not rewritten into present tense.

| Area                                            | Pre-audit files | What was checked                                                                                                                                                             | Living truth owner                                    |
| ----------------------------------------------- | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Root configuration, data and archived runtime   |              37 | Entry points, Node/npm/Vite/TypeScript/Playwright/Wrangler configuration, static headers, four market data files, legacy script order and root audit-snapshot classification | `README.md`, `AGENTS.md`, architecture and operations |
| GitHub workflow                                 |               1 | Schedule, permissions, approved upstream guard, three-file validation/change allowlist and commit-if-diff behavior                                                           | operations and market live-evidence spec              |
| Living and evidence documentation               |              46 | Link targets, ownership, implementation status, current-vs-historical wording, command names and duplicated truth                                                            | `docs/README.md` plus section READMEs                 |
| Generator, audit, market and deployment scripts |              32 | Package-script reachability, source/output boundaries, generated report ownership, architecture graph, three-file writer and release-gate ownership                          | architecture, testing and operations                  |
| Production `src` outside tests                  |              69 | Domain/adapters/app/data/server boundaries, generated root bootstrap, storage keys, worker boundary, same-origin APIs and implementation-to-spec coverage                    | architecture and feature inventory                    |
| Tests and text fixtures                         |              89 | Suite ownership, fixture role, focused commands, functional scenario inventory and absence of undocumented live-test requirements                                            | testing                                               |
| Reviewed Darwin PNG baselines                   |              31 | Exact file count and correspondence to the 20 visual scenarios and detail captures                                                                                           | visual-regression spec and testing                    |
| **Total**                                       |         **305** | Complete final repository inventory                                                                                                                                          | This report records the audit boundary                |

## Verification evidence

The audit used repository-local, read-only inspection before documentation
edits:

- `git status --short` to preserve the user's existing worktree changes;
- full hidden-file inventory with `rg --files --hidden`;
- source export/global and line-count scans for every JavaScript/TypeScript
  runtime and script file;
- the repository-owned `npm run architecture:check` graph guard after it was
  added during the audit window;
- test-title inventory for every unit and browser test file;
- package-script comparison for every `npm run ...` reference in Markdown;
- Markdown link resolution across every repository `.md` file;
- direct route and storage-key searches across app, adapters, server, tests and
  archived legacy sources;
- committed market capture/provenance timestamp comparison; and
- Git history inspection for the current generated price artifacts.

At the inspection point there were no broken local Markdown links and no
documented `npm run` command missing from `package.json`.

## Validation results

- JSON parsing passed for the four committed market files and all four
  committed generated runtime/source-pin files.
- Local Markdown links passed across 52 Markdown files.
- Every documented `npm run` command resolved to `package.json`.
- `npm run architecture:check` passed with 63 source modules, no cycles, 50
  client-reachable modules and five documented legacy-migration exceptions.
- `npm run test` passed 40 files and 623 tests, including 19 legacy goldens.
- `npm run lint` passed.
- The focused Prettier check for every document changed by this audit passed.
- `git diff --check` passed for the worktree except the concurrently changed
  `ARCHITECTURE_AUDIT.md`, whose date and audited-HEAD lines contain trailing
  spaces. Those lines were not part of the audit's own edit set.
- `npm run typecheck` is not green in the final worktree. The architecture
  check added during the audit window indexes its typed layer-policy object with
  a general string at `scripts/check-architecture.ts:83`, producing TS7053.
  Build and full `npm run verify` were not run because they start with the same
  failing TypeScript gate. This is source/tooling work outside the
  documentation-only correction set.

## Deliberately preserved evidence

The following content can contain superseded counts, hashes or old architecture
descriptions when it is explicitly labelled historical:

- root `ARCHITECTURE_AUDIT.md`, `PROJECT_REVIEW_NOTES.md` and
  `SECURITY_AUDIT.md` snapshots;
- superseded Playwright failure matrices and dated implementation-gate rows in
  `docs/technical/testing.md`;
- generated Planner, revision-impact, NPC-attack and numeric audit reports; and
- historical decision rationale that is superseded by a later numbered
  decision.

These remain evidence, not living current-state truth. New current claims must
not cite an old count without its date and context.

## Open questions

- Resolved 2026-07-14: `docs/technical/testing.md` remains the current command
  and strategy owner, while dated implementation, release and superseded
  failure snapshots live in [testing-evidence.md](testing-evidence.md).
- Should a future maintainer add an automated documentation consistency check
  for local links, package-script references, visual scenario/baseline counts
  and market logical-set filenames? No general merge CI owner is currently
  accepted.
- A complete configured scheduled market run for the current 92-row allowlist
  is still adopter evidence. Repository files alone cannot prove that external
  run, so public copy must not claim scheduled-current prices until it is
  observed.
- A canonical remote visual platform and merge-blocking policy remain an open
  CI decision even though the repository-local Darwin suite is implemented.

## Maintenance rule

When a later change alters an entrypoint, source owner, persisted key, API
route, market artifact, package command, test inventory or implementation
status, update the owning living document in the same change. Refresh this
audit only for another repository-wide review; do not turn it into a competing
architecture or testing source of truth.

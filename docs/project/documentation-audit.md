# Repository documentation audit

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
  simulation backend, auth service or database;
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

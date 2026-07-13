# Current worktree delivery specification

- Status: completed
- Date: 2026-07-10
- Owner: project delivery
- Source: current repository worktree and backlog delivery work
- Related documents: [backlog.md](backlog.md), [../technical/testing.md](../technical/testing.md), [../operations/README.md](../operations/README.md)

## Purpose

Deliver the current accumulated rewrite work to `origin/master` as reviewable commits without losing, rewriting or silently mixing existing user changes. This is a repository-delivery task, not a product feature, so it does not change a feature-inventory status.

The executor must treat the worktree present at execution time as the source of truth. The snapshot below is orientation evidence only and must be refreshed before staging.

## Current snapshot

On 2026-07-10:

- the checked-out branch is `master`, tracking `origin/master`
- the latest committed local revision is `4ec8985`
- the index has no staged changes
- the tracked diff covers 75 files with 4,143 insertions and 1,517 deletions
- 42 individual untracked files are present, including generated Planner parity evidence, permalink and visual-regression implementation, Playwright helpers and 23 Darwin screenshot baselines
- the worktree contains several completed backlog slices, tests, generated-data work and documentation changes accumulated across earlier goals

These counts are expected to change when this specification is executed. A changed count is not itself an error.

## Delivery evidence

Completed on 2026-07-10 and delivered to `origin/master` as four reviewable commits:

- `bc7aa84` - Harden generated data and economy foundations
- `2ee932d` - Complete rewrite workflows and setup sharing
- `f728cf1` - Add planner parity and visual regression evidence
- `c6ac684` - Document completed rewrite and delivery boundaries

Validation evidence:

- `npm run typecheck`: pass
- `npm run test`: pass, 31 files and 497 tests
- `npm run test:golden`: pass, 19 tests
- `npm run build`: pass with the known Vite chunk-size advisory
- `npm run lint`: pass
- `npm run format:check`: pass
- `npm run planner:parity`: pass, 16 cases, 32 comparisons, no review or rewrite-gap rows
- `npm audit`: pass, zero vulnerabilities
- `git diff --check`: pass
- functional and visual Playwright commands reached their production builds but the managed sandbox rejected localhost preview binds with `listen EPERM` on `127.0.0.1:5173` and `127.0.0.1:5174`; the last recorded functional gate remains 53/53 and all 23 Darwin visual baselines were reviewed during delivery

After the push, local `HEAD` and `origin/master` both resolved to `c6ac6845a8458650a6913f3c9d45c09efc8933ff`, divergence was `0/0` and `git status --short` was clean. No force push, history rewrite or user-change removal was used.

### 2026-07-13 follow-up delivery

The next accumulated architecture/workflow worktree started from
`19c9557c7ace12bbbff10c5a7ab8aea2b8b55150` on local `master`; a fresh fetch
confirmed `origin/master...master` at `0/0` before staging. It is grouped as:

- `fb160bc` - Refactor rewrite app ownership and state
- `abb49f3` - Add architecture and startup release gates
- one documentation/handoff commit containing only root guidance, audits,
  living docs and implementation specifications

Pre-documentation delivery validation passed 694/694 unit tests, 19/19 explicit
goldens, typecheck, the 81-module zero-cycle architecture check, production
build/artifact budgets, lint, Prettier and `git diff --check`. The complete
production-preview Chromium gate passed 77/77. The 10-file/two-asset artifact
is 1,953,715 bytes with SHA-256
`00193bd3b92bf8f1faf6c25eca880ff74f5106f483e3dd3998bf8966e33b62bf`.
The delivery uses no force push or history rewrite; final remote identity and
clean-worktree evidence belong to the execution report because the
documentation commit cannot record its own final SHA.

## Delivery outcome

The work is done when:

1. every intended current change is reviewed and assigned to a coherent commit
2. unrelated or intentionally deferred files remain intact and unstaged
3. required validation passes against the exact committed tree
4. local `master` is pushed to `origin/master` without force
5. local `HEAD` equals the verified remote `origin/master` revision
6. `git status --short` is clean, or any intentionally retained files are explicitly listed in the delivery report

## Non-goals

- changing application behavior while preparing commits
- merging or rebasing the separate `upstream` remote
- choosing a public host, domain, hiscores provider or logging policy
- rewriting published history, force-pushing or squashing unrelated changes
- deleting archived legacy files
- regenerating source snapshots merely to make the worktree smaller
- staging all files without reviewing their ownership and provenance

## Safety rules

- Never use `git reset --hard`, `git clean`, destructive checkout/restore commands or force push.
- Never discard a change because it does not fit the first proposed commit group.
- Use explicit path manifests for staging. Avoid `git add .` and interactive staging for this delivery.
- Inspect staged content with both `git diff --cached --stat` and `git diff --cached` before each commit.
- Treat generated JSON, reports and screenshot baselines as reviewable artifacts, not disposable build output.
- Stop if credentials, raw upstream payloads, local absolute paths or unexpected personal data appear in a candidate commit.
- Do not push until all commits and the final combined tree pass their required checks.

## Phase 1: Freeze and inventory the candidate tree

Run:

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
git diff --stat
git diff --check
git ls-files --others --exclude-standard
```

Then:

- confirm the branch is `master` and its upstream is `origin/master`
- record the starting commit and full modified/untracked path list in the delivery notes
- confirm there are no already-staged files; if there are, preserve and review them as a separate pre-existing staged set
- inspect every untracked path before any staging
- review generated reports and screenshot baselines for expected content and provenance
- scan changed text for secrets, tokens, raw payloads, unexpected absolute paths and player names

## Phase 2: Refresh the remote boundary

Fetch `origin` before staging and compare the histories:

```sh
git fetch origin
git rev-list --left-right --count origin/master...master
git log --oneline --decorate --graph --max-count=20 --all
```

Expected safe state: `origin/master` has no commits missing locally.

If `origin/master` advanced, stop the delivery sequence before committing or pushing. Preserve the worktree, create a named safety branch if needed, and integrate the remote changes only after reviewing the overlap. Re-run the complete validation set after integration. Do not resolve divergence with a force push.

## Phase 3: Build commit manifests

Use the following ordering as the default. Shared files such as `package.json`, documentation indexes or broad integration tests may justify combining adjacent groups. Prefer a larger coherent commit over unsafe line-level staging.

### Commit 1: Source-backed data and runtime foundations

Candidate ownership:

- generated-data schemas, adapters and runtime readiness
- LostCity source parsing, coverage and impact tooling
- market writer, canonical item/price mapping and generated requirement lookup foundations
- focused generator, economy, runtime and market tests

Exclude UI-only state, permalink/visual work and release documentation unless a source change cannot be reviewed without its generated evidence.

### Commit 2: Rewrite workflows and browser state

Candidate ownership:

- `src/app` workflow, view-model and state changes
- browser/storage adapters and migration behavior
- generated-requirement UI wiring
- shareable setup permalink behavior
- functional UI, state, adapter and end-to-end tests

Keep `SimulationRequest` free of UI-only state and verify that storage changes retain versioned, sanitized failure behavior.

### Commit 3: Parity and visual evidence tooling

Candidate ownership:

- Planner parity fixtures, helpers, tests, report script and generated current report
- visual Playwright config, deterministic helpers, visual spec and reviewed screenshot baselines
- package scripts needed only by those tools

Review every changed PNG through a contact sheet or direct image comparison before staging it. Platform baselines must remain clearly labeled and reproducible.

### Commit 4: Documentation and release evidence

Candidate ownership:

- architecture, product, testing, operations, decisions and backlog updates
- implementation specifications and generated evidence notes
- formatter ownership exclusions required by deterministic writers

Documentation must describe the code state in the preceding commits. Do not record undecided provider, hosting, domain or logging choices as accepted facts.

## Phase 4: Validate each commit candidate

For every manifest:

1. stage only the explicit paths
2. inspect `git diff --cached --name-status`, `--stat` and the complete staged diff
3. run the focused tests owned by that candidate
4. run `git diff --cached --check`
5. commit only after the candidate is internally coherent
6. record the commit SHA and checks in the delivery notes

Suggested focused checks include:

```sh
npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/market-writer.test.ts
npm run test -- src/tests/planner-domain.test.ts src/tests/ui-view-model.test.ts src/tests/shareable-setup.test.ts
npm run planner:parity
npm run test:e2e:visual
```

Choose only the checks relevant to each group. The final combined gate below is mandatory.

## Phase 5: Run the combined release-quality gate

Run against the committed tree:

```sh
npm run typecheck
npm run test
npm run test:golden
npm run build
npm run lint
npm run format:check
npm run planner:parity
npm audit
npm run test:e2e
npm run test:e2e:visual
git diff --check
```

Browser checks may be reported as environment-blocked only when the exact environment limitation and the last passing evidence are recorded. Unit, type, build, lint, format and diff checks are not optional for this delivery.

After validation, confirm that no test or generator changed tracked files unexpectedly. Any resulting diff must be reviewed and committed to its owning group or intentionally left with a documented reason.

## Phase 6: Push and verify

Immediately before pushing:

```sh
git fetch origin
git rev-list --left-right --count origin/master...master
git status --short
```

Push only when the remote has not advanced and the worktree state matches the delivery report:

```sh
git push origin master
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

The two revisions must match. Record the delivered commit list and final remote SHA.

## Failure and rollback behavior

- Before push, preserve completed commits and fix forward on the local branch; do not discard the original worktree.
- If remote divergence appears, stop, fetch and integrate deliberately on a safety branch before updating `master`.
- If a pushed commit must be undone, use an explicit revert commit. Do not reset or force-push shared `master`.
- If one commit fails review, amend or replace only that unpublished commit while retaining the rest of the reviewed history.
- If a secret is found, stop before push and follow credential-revocation and repository-history guidance; deleting it from the final file alone is insufficient.

## Review checklist

- [x] Starting branch, upstream, commit and path inventory recorded
- [x] All untracked files classified
- [x] No pre-existing staged change overwritten
- [x] Remote divergence checked before staging and before push
- [x] Every commit has a path manifest and focused validation evidence
- [x] Generated reports and screenshot baselines reviewed
- [x] No raw source payload, credential, absolute local path or player data committed
- [x] Combined release-quality gate recorded, with the sandbox-only browser limitation explicit
- [x] Push used `origin master` with no force
- [x] Local and remote final SHAs match
- [x] Final worktree state reported

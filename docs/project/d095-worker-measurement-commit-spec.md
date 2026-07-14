# D-095 worker measurement commit specification

Status: Specced, not executed.

## Purpose

Package the implemented calculation Worker measurement work and D-095 decision
as one reviewable commit, without mixing in the later D-096 structural
assessment or the Simulation/MonsterCard refactor specification.

This is a delivery-scope specification. It does not change Worker behavior,
measurement output, acceptance evidence or D-095 itself.

## Current context

On 2026-07-14 the worktree contains multiple completed or specced slices:

- D-095 calculation Worker measurement source, tooling and documentation;
- D-096 Trip and game-data-generator structural assessment;
- Simulation/MonsterCard view-model refactor specification;
- shared documentation files that contain hunks from more than one slice.

Because the same docs files contain adjacent D-095, D-096 and MonsterCard
changes, the D-095 commit must be staged from an explicit manifest. Do not use
`git add .`.

## Commit title

Use:

```text
Measure calculation worker startup and transfer
```

## Include in the D-095 commit

Stage these complete files when their diff is entirely D-095-owned:

- `.gitignore`
- `eslint.config.js`
- `package.json`
- `src/app/calculation-task.ts`
- `src/app/calculation-worker-client.ts`
- `src/app/calculation-worker.ts`
- `src/tests/calculation-task.test.ts`
- `docs/technical/calculation-worker-measurement-spec.md`
- `scripts/measure-calculation-worker.mjs`
- `scripts/vite-worker-measurement.config.ts`
- `scripts/worker-measurement-browser.ts`
- `scripts/worker-measurement.html`

Stage only D-095 hunks from these shared documentation files:

- `AGENTS.md`: Calculation Worker measurement source-map row.
- `README.md`: `npm run worker:measure -- --runs 5` quick-start note.
- `docs/operations/README.md`: local runtime/measurement paragraph that adds
  worker measurement beside startup measurement.
- `docs/technical/README.md`: calculation-worker measurement specification
  entry only.
- `docs/README.md`: calculation-worker measurement ownership or map entry only.
- `docs/technical/architecture.md`: worker measurement/current-risk boundary
  only. Exclude D-096 Trip/generator assessment and MonsterCard specification
  hunks.
- `docs/technical/testing.md`: D-095 validation note, worker measurement
  command section and post-D-095 count/artifact evidence only.
- `docs/project/backlog.md`: D-095 worker measurement card only. Exclude D-096
  and MonsterCard backlog state changes.
- `docs/project/decisions.md`: D-095 decision row and post-D-095 validation
  evidence only. Exclude D-096 decision row.

If a shared file cannot be staged cleanly with normal patch selection, prepare a
reviewable temporary patch and apply it to the index with `git apply --cached`.
Keep the working tree content intact.

## Exclude from the D-095 commit

Leave these unstaged for separate commits:

- `docs/technical/large-module-structural-split-assessment.md`
- any D-096 hunks in `docs/README.md`, `docs/technical/README.md`,
  `docs/technical/architecture.md`, `docs/project/backlog.md` or
  `docs/project/decisions.md`
- `docs/technical/simulation-monster-card-view-model-refactor-spec.md`
- any Simulation/MonsterCard hunks in `docs/README.md`,
  `docs/technical/README.md`, `docs/technical/architecture.md` or
  `docs/project/backlog.md`
- this delivery specification, unless a separate documentation/planning commit
  intentionally includes it
- unrelated local files, caches, build output and measurement output

## Pre-staging safety checks

Run:

```sh
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
git diff --check
git ls-files --others --exclude-standard
```

Then fetch and verify the remote boundary before committing:

```sh
git fetch origin
git rev-list --left-right --count origin/master...master
```

Expected safe state: branch is `master`, upstream is `origin/master`, no staged
changes exist before staging, and `origin/master` has not advanced beyond local
`master`. If the remote has advanced, stop before committing and integrate
remote changes through a separate reviewed step.

## Staged-diff review

Before committing, inspect:

```sh
git diff --cached --name-status
git diff --cached --stat
git diff --cached
git diff --cached --check
```

The staged name list must contain D-095 files and D-095 hunks only. In
particular, it must not contain:

- `docs/technical/large-module-structural-split-assessment.md`;
- `docs/technical/simulation-monster-card-view-model-refactor-spec.md`;
- D-096 decision/backlog/architecture prose; or
- MonsterCard split prose.

## Validation before commit

Run the focused D-095 checks against the staged candidate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts
npm run worker:measure -- --runs 5
npm run numeric:audit
npm run test:golden
npm run build
npm run deploy:verify-artifact
npm run lint
npm run format:check
git diff --check
```

`npm run worker:measure -- --runs 5` needs local Chromium and localhost
binding. If the managed sandbox blocks the preview bind with `listen EPERM`,
rerun only that command through the approved localhost path and record the exact
boundary in the delivery notes.

Run the final repository gate before or immediately after the commit:

```sh
npm run verify
```

Do not update numeric baselines, golden fixtures, visual baselines or generated
runtime data as failure recovery for this commit.

## Commit execution

Commit only after the staged diff and validation pass:

```sh
git commit -m "Measure calculation worker startup and transfer"
```

After committing, verify no D-095 file was left partially staged or partially
unstaged by accident:

```sh
git status --short
git show --name-status --stat --oneline --no-renames HEAD
```

The remaining dirty worktree may still contain D-096 and MonsterCard planning
changes. That is acceptable if they are explicitly listed in the delivery
report and remain uncommitted.

## Acceptance criteria

- The D-095 commit is reviewable on its own: source, measurement harness,
  package script, tests and D-095 docs are together.
- Raw worker request/response compatibility remains covered.
- The measurement harness remains isolated from `dist` and
  `.worker-measurement-dist` is ignored by Git and ESLint.
- D-095 documents measured facts separately from the decision to keep one-shot
  workers.
- D-096 and Simulation/MonsterCard planning changes are absent from the commit.
- Required validation is recorded with pass/fail or exact environment-blocked
  notes.

## Push boundary

This spec covers creating the D-095 commit. Pushing to `origin/master` belongs
to a later worktree-delivery step unless the user explicitly asks to push.

Before any later push, rerun:

```sh
git fetch origin
git rev-list --left-right --count origin/master...master
git status --short
```

Do not force push.

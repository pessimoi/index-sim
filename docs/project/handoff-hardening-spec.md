# Repository handoff hardening specification

- Status: complete
- Date: 2026-07-11
- Owner: project docs
- Source: adopter-ready completion boundary D-067
- Related decisions: [D-059, D-060, D-065, D-066 and D-067](decisions.md)

## Purpose

Make the repository technically handoff-ready for a new maintainer without
requiring access to the current maintainer's machine, Cloudflare account,
GitHub Actions history or gitignored source checkout.

This work closes onboarding and reproducibility gaps. It does not add product
features, deploy a public instance, enable a database, add general CI or weaken
the live-integration claim gates.

## Pre-implementation state check

At activation, the root Vite rewrite, generated Revision 274 runtime, Hiscores
provider, scheduled market writer and optional Cloudflare deployment package
were already implemented. Feature inventory marked the accepted user workflows
`Valmis`.

The remaining handoff gaps at activation were repository ergonomics and stale
documentation:

- root `README.md` starts with run commands but omits lockfile installation;
- no generic repository verification command exists outside the Cloudflare-
  named release command;
- no fresh-checkout result proves that committed generated data is sufficient
  without `.sources/lostcity-content`;
- the source pin names `LostCityRS/Content` and a commit but the maintainer
  runbook does not include the checkout URL/commands;
- some technical indexes and open-question tables predate D-066/D-067;
- no repository license is present, and the local `upstream/main` tree does not
  provide one that can safely be inherited without a separate rights decision.

## Required implementation

### 1. Fresh-clone quick start

Root `README.md` must provide the shortest supported path:

1. clone the repository;
2. activate Node 22 through `.nvmrc` or an equivalent installation;
3. install exactly from `package-lock.json` with `npm ci`;
4. run the repository verification command;
5. start `npm run dev` or build/preview the production artifact.

The quick start must state that normal install, verify, build and runtime do not
need `.sources/`, Cloudflare credentials, environment variables or a database.

### 2. Generic repository verification

Expose one provider-neutral `npm run verify` command. It must reuse the current
authoritative gate rather than maintain a second list of checks. The gate must
cover:

- TypeScript typecheck;
- full Vitest suite;
- explicit legacy golden suite;
- production build and artifact validation;
- ESLint and Prettier checks;
- dependency audit when network access is available;
- `git diff --check`.

The command may share its implementation with the D-066 Cloudflare build gate,
but its name and failure copy must make sense before any provider account exists.
Playwright remains a separate environment-dependent command.

### 3. Fresh-checkout evidence

Validate the committed `HEAD` in a detached repository-local temporary
worktree. The evidence run must:

- contain no copied `.sources/`, `node_modules`, `dist`, `.vite` or local test
  output;
- install with `npm ci` from the committed lockfile;
- run `npm run verify` successfully;
- prove `npm run build` consumes the committed generated snapshot and market
  files without the raw LostCity checkout;
- leave the primary worktree unchanged and remove the temporary worktree after
  evidence is collected.

Do not commit the temporary worktree, npm cache, build output or logs.

### 4. Game-source maintainer runbook

Document the optional raw source setup separately from ordinary onboarding:

- repository: `https://github.com/LostCityRS/Content.git`;
- local gitignored path: `.sources/lostcity-content`;
- active source commit from `src/data/generated/source-pin.json`;
- clone/fetch/checkout commands that do not rewrite generated output by
  themselves;
- generation, impact review and validation commands;
- explicit statement that source code is MIT-licensed while upstream assets
  are excluded from that software license, as stated by LostCityRS/Content;
- no raw source bodies or assets are copied into this repository.

The committed source pin remains the machine-readable authority for the active
revision. Documentation must not duplicate a commit hash without telling the
maintainer to compare it with that file.

### 5. Documentation consistency

Remove or reclassify stale statements that:

- describe the Hiscores provider/runtime as still unimplemented;
- ask for a deployment-provider decision after D-066;
- describe the configured market root variable as undecided;
- turn D-067 adopter operations back into repository blockers.

Preserve the truthful distinction between repository readiness and evidence for
a concrete public instance.

## Licensing and distribution boundary

Do not add a `LICENSE` file or package `license` value in this goal. The current
repository contains rewritten code plus retained upstream legacy/reference
files, and the checked local `index-rs/index-sim` upstream tree provides no
license file that can be inherited automatically.

A private technical handoff can proceed with this boundary documented. Public
redistribution or an open-source release requires a separate human-approved
rights audit and license decision covering at least:

- retained `index-rs/index-sim` code and history;
- new rewrite code ownership;
- generated data and LostCityRS/Content source-vs-asset distinction;
- third-party notices required by bundled or retained material.

Keep `package.json` private and at its current non-release version until that
decision also defines release/versioning policy.

## Security and privacy boundaries

- Do not add secrets, `.env` files, account identifiers or access tokens.
- Do not copy the raw LostCity checkout into committed files.
- Do not run a live Hiscores player lookup for handoff evidence.
- Do not add user-triggered market refresh or `workflow_dispatch`.
- Keep D-065 no-player-query logging and D-067 adopter-operation boundaries.
- Fresh-checkout output must not contain absolute local paths in committed
  artifacts or documentation.

## Validation

Repository implementation checks:

```sh
npm run verify
git diff --check
```

Fresh-checkout evidence uses a detached repository-local worktree, then:

```sh
npm ci
npm run verify
```

Playwright and visual suites remain separate because browser installation and
platform-specific baselines are environment-dependent. Existing reviewed
browser evidence remains valid when this goal changes only scripts and docs.

## Completion evidence

Commit `43f8b5f` was validated on 2026-07-11 in a detached repository-local
worktree created from that exact commit:

- the checkout initially had no `.sources`, `node_modules`, `dist`, `.vite` or
  test output;
- explicit `nvm use` selected Node `22.19.0` and npm `10.9.3`;
- `npm ci` installed 237 packages from `package-lock.json` and reported zero
  vulnerabilities;
- `npm run verify` passed 34 files/523 tests, the explicit 19-test golden suite,
  typecheck, build, artifact validation, lint, formatting and diff hygiene;
- a separate network-enabled `npm audit` reported zero vulnerabilities;
- the artifact retained 7 files, 2 hashed assets, 1,384,153 bytes, 13 market
  history snapshots and SHA-256
  `a8bd9ee19cfa6c17ff659006cbde54e50ab846e2c93e276098fa2af35bf4d2ce`;
- `.sources` remained absent while `dist/index.html` was produced from committed
  generated data;
- the temporary worktree was removed and the primary worktree stayed clean.

The optional source runbook command was also checked against the current local
gitignored checkout: its `HEAD` matched `source.commit`
`376072662e78a314bf35bb18815be39521491a6b` from the committed source pin.

## Done when

- the quick start works from a fresh checkout with Node 22/npm 10;
- `npm run verify` is the single documented repository gate and passes;
- fresh-checkout evidence passes without `.sources` or external accounts;
- the optional raw source setup is reproducible from URL plus committed pin;
- stale D-066/D-067 documentation contradictions are removed;
- licensing remains an explicit public-distribution decision boundary;
- backlog and documentation maps describe the handoff package as complete;
- changes are committed and pushed without force to `master`.

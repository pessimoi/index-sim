# Developer quality and release-gate separation specification

- Status: implemented
- Date: 2026-07-31
- Owner: developer workflow and technical testing
- Evidence: verified
- Contract: living

## Purpose

Separate the normal developer feedback loop from repository handoff and public
deployment ceremony without weakening calculation, architecture, persistence,
security or release-impact validation.

The current `npm run verify` command is implemented by
`scripts/run-cloudflare-release.mjs gate`. It is both the documented repository
handoff gate and the Cloudflare build gate. A normal source change therefore
inherits production build, public-artifact validation and a network-dependent
dependency audit even when it cannot affect a deployable artifact.

This specification adds a lightweight authoritative developer gate, retains a
full handoff/release gate and removes duplicate work inside the full runner.

## Verified starting state

- `npm run verify` and `npm run deploy:cloudflare:build` invoke the same
  `gate` command.
- The gate runs `tsc -b`, architecture, documentation, the full Vitest suite,
  an explicit `legacy-golden.test.ts` run, another `tsc -b`, Vite build,
  deployment artifact validation, lint, formatting, `npm audit` and
  `git diff --check`.
- `vitest.config.ts` includes every `src/**/*.test.{ts,tsx}` file, so the full
  Vitest run already collects `legacy-golden.test.ts`.
- Browser, cross-browser, visual, startup and deployed-smoke suites are already
  separate environment-dependent commands.
- No active remote merge gate or public deployment currently consumes
  `npm run verify`; D-067 classifies concrete deployment as adopter operation.

## Gate classes

### Focused feedback

Focused commands remain the first feedback loop and are selected by the
change-type table in `docs/technical/testing.md`:

```sh
npm run test -- <affected test files>
npm run typecheck
npm run architecture:check
```

Focused success is preliminary evidence. It must not be described as the
repository quality result.

### Normal developer quality gate

Add one provider-neutral npm script named `quality`.

It must run each of these exactly once:

1. TypeScript type checking;
2. architecture checking;
3. documentation checking;
4. the full Vitest suite;
5. ESLint;
6. Prettier check; and
7. `git diff --check`.

It must not:

- build `dist`;
- validate the Cloudflare artifact;
- invoke Wrangler;
- call a network provider;
- run `npm audit`;
- run the explicit legacy-golden suite after the full Vitest suite;
- run Playwright, visual comparison or deployed smoke; or
- write fixtures, baselines, generated data or evidence.

The proposed `quality` script is the normal
commit/handoff-to-another-developer gate. Topic minimums may add stronger
impact-specific checks before it.

### Repository handoff gate

Add an npm script named `verify:handoff`.

It must compose the normal quality checks with:

- one production build;
- artifact validation;
- dependency audit when network access is available; and
- any source/data-specific handoff checks already required by the owning
  change-type guide.

It must reuse completed quality stages rather than rerun TypeScript, Vitest,
lint, formatting or documentation checks.

Keep `npm run verify` as a compatibility alias to `verify:handoff` for the first
implementation. Current onboarding and adopter runbooks may continue to call
it. Removing or changing that alias requires a later explicit documentation
and consumer review.

### Deployment gate

`npm run deploy:cloudflare:build` may call `verify:handoff`, but provider upload
commands must continue to build and validate the exact source state they
upload. Preview/deploy commands must not rely on an old `dist` directory.

Functional browser, cross-browser, visual, accessibility-manual and deployed
smoke evidence remain separately routed. They become required only when the
affected surface or a release claim activates them.

## Impact routing

| Change surface                                | Required before the proposed `quality` script | Additional handoff/release evidence                  |
| --------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Documentation only                            | Focused link/metadata review                  | None unless commands or release claims change        |
| Pure domain formula                           | Focused domain tests and goldens              | Numeric/revision impact when applicable              |
| Persistence or transfer                       | Focused state/controller tests                | Affected browser transaction                         |
| UI workflow                                   | Focused component/view-model tests            | Affected Playwright path                             |
| Entrypoint, generated runtime or build config | Focused architecture/runtime tests            | Build, artifact and startup/bundle checks            |
| Server/provider boundary                      | Focused handler/adapter tests                 | Artifact; deployed smoke only for an approved origin |
| Lockfile or toolchain                         | Focused tool invocation                       | Full dependency audit and build                      |
| Cloudflare config or release runner           | Runner/config tests                           | Dry-run, artifact and adopter evidence as activated  |

The table separates impact from branch or commit naming. A small change may
still require a strong check when it touches a high-impact boundary.

## Runner implementation requirements

- Define the gate stages in one data structure or set of composable functions;
  do not maintain separate drifting command lists for quality and handoff.
- Give every stage a stable name and print it before execution.
- Fail immediately on the first failed stage and preserve that command's exit
  status.
- Preserve repo-local npm/Wrangler cache paths and disabled Wrangler telemetry.
- Keep network-disabled audit skipping explicit in output.
- Add a testable dry trace or pure stage-plan function so tests can prove stage
  order, uniqueness and class membership without executing the whole gate.
- Assert that the quality plan contains neither build/artifact/audit nor
  duplicate stage names.
- Assert that the handoff plan contains exactly one typecheck, full test, build,
  artifact and audit stage.

## Safeguards that remain mandatory

- The full Vitest suite continues to collect legacy goldens until the separate
  legacy-fixture extraction specification is implemented.
- `test:golden` remains a valid focused command for calculation-impact work.
- Architecture checking continues to block source cycles, forbidden layer
  edges and client reachability into archived runtimes.
- Persistence, transaction, rollback, concurrency and security tests are not
  reclassified as release-only.
- Artifact hygiene, CSP/header checks and entry-JavaScript budgets remain in
  the handoff/release path and in impact routing for affected build surfaces.
- No failing test, lint rule, type error or audit finding may be converted to a
  warning merely to make a gate lighter.

## Non-goals

- No change to product behavior, formulas, schemas or persisted data.
- No remote CI or branch-protection system.
- No test selection inferred only from `git diff`.
- No removal of browser, cross-browser, visual or deployed smoke commands.
- No dependency upgrade; the current findings have their own remediation
  specification.
- No public deployment or change to Cloudflare account assumptions.

## Implementation sequence

1. Extract a deterministic stage plan from the current release runner.
2. Add runner tests for quality, handoff, dry-run, preview and deploy plans.
3. Remove the second `tsc -b` and the second legacy-golden execution.
4. Add `quality` and `verify:handoff`; retain `verify` as the compatibility
   alias.
5. Route Cloudflare build/upload through the composed handoff/build plan.
6. Update `README.md`, technical testing, operations and `AGENTS.md` so normal
   development uses `quality` and release/handoff uses the stronger gate.
7. Update dated testing evidence only after both commands have been run.

## Acceptance checks

```sh
npm run test -- <new runner test file>
npm run deploy:verify-artifact
npm run docs:check
npm run format:check
git diff --check
```

Acceptance also runs the proposed `quality` and `verify:handoff` scripts through
npm after those scripts exist.

Record elapsed stage timings as dated evidence for comparison, not as universal
SLAs. Acceptance requires observable elimination of duplicate TypeScript and
legacy-golden stages.

## Done when

- normal development has one documented provider-neutral `quality` gate;
- the complete handoff path remains available under `verify:handoff` and the
  compatibility `verify` alias;
- stage-plan tests prove no duplicate expensive stages;
- product correctness and impact-based testing rules are unchanged;
- Cloudflare upload commands still validate the exact artifact they upload;
  and
- owning run/testing/agent documents agree on the new command classes.

## Implementation checkpoint

The shared stage plan, `quality`, `verify:handoff`, `verify` compatibility
alias, runner tests and owning documentation are implemented. Focused
release-plan/documentation tests, typecheck, lint, formatting, whitespace,
production build and artifact validation pass. A Node 22 run of the complete
functional Vitest collection excluding the environment-sensitive performance
file passed 121 files and 1,132 tests.

The canonical Node 22 `quality` plan subsequently passed all seven stages,
including 122 Vitest files and 1,135 tests. The maximum Duel matrix test's
wall-clock harness allowance was aligned from 20 to 30 seconds, but its
product-facing 12-second CPU budget remains unchanged.

`verify:handoff` retains the dependency-audit stage whose current advisory
request is separately blocked by the explicit disclosure boundary in the
toolchain audit specification. That external evidence gate does not reopen the
implemented quality/handoff separation or block normal development. No
provider or product correctness invariant is waived.

## Open questions

- None for the initial compatibility-alias implementation. Removing the
  `verify` alias or making remote CI authoritative requires a later consumer
  and operations decision.

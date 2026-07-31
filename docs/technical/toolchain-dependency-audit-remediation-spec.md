# Toolchain dependency audit remediation specification

- Status: active
- Date: 2026-07-31
- Owner: Node toolchain and deployment tooling
- Evidence: partial
- Contract: living

## Purpose

Restore a clean dependency-security baseline without using audit remediation as
an excuse for unrelated framework upgrades, weakened checks or production
architecture changes.

The dev-first audit found no production dependency vulnerability but found five
high-severity entries in the development dependency tree. This specification
owns the minimal reviewed lockfile update and the future routing of dependency
audits.

## Verified starting state

The 2026-07-31 audit used the committed lockfile with Node 22:

- `npm audit --omit=dev --json` reported zero vulnerabilities;
- full `npm audit --json` reported five high-severity dependency entries;
- the affected names were `wrangler`, `miniflare`, `sharp`,
  `brace-expansion` and `postcss`;
- Wrangler `4.109.0` is a direct pinned development dependency;
- the audit identified a non-major Wrangler update as the available fix for
  the Wrangler/Miniflare/Sharp path; and
- no `npm audit fix` or lockfile mutation was performed.

Audit results are time-sensitive external evidence. Implementation must rerun
the audit and use its current dependency paths rather than treating this list
as permanent truth.

## Required remediation

### Reproduce and classify

Use the repository Node/npm contract and capture:

```sh
npm audit --json
npm audit --omit=dev --json
npm explain wrangler
npm explain miniflare
npm explain sharp
npm explain brace-expansion
npm explain postcss
```

For every current high or critical finding, record:

- direct or transitive ownership;
- affected execution surface;
- whether untrusted project or upstream content reaches the vulnerable code;
- the smallest compatible fixed parent version;
- whether the fix changes Wrangler bundle output, Vite transforms, CSS
  processing or test behavior; and
- whether the finding remains after a clean lockfile install.

### Apply the smallest compatible update

- Update direct dependencies only where necessary to select fixed transitives.
- Prefer the smallest non-major Wrangler update that clears the current
  Wrangler/Miniflare/Sharp advisories and supports the committed config.
- Let npm resolve fixed transitive `brace-expansion` and `postcss` versions
  through their owning packages where possible.
- Use Node 22 and npm 10 when generating `package-lock.json`.
- Do not run `npm audit fix --force`.
- Do not combine React, TypeScript, Vite, Vitest, Playwright, ESLint or Zod
  feature upgrades unless one is the direct minimal owner of a remaining
  finding.
- Do not add an override without documenting why a compatible parent update
  cannot own the fix and proving the override satisfies every parent range.

### Prove deployment-tool compatibility

Because Wrangler is the direct affected package, run:

- config parsing and Cloudflare Worker tests;
- account-free Wrangler dry-run;
- build and artifact validation;
- Durable Object binding/migration inspection;
- preview/deploy command argument-plan tests without uploading; and
- documentation checks for any exact pinned-version references.

No Cloudflare account, preview upload or live deployment is required for this
remediation.

## Audit routing after remediation

Dependency security remains a real safeguard, but a network audit is not part
of the lightweight offline developer gate.

Require full `npm audit`:

- after any `package.json` or `package-lock.json` change;
- before repository handoff;
- before a public deployment upload;
- during a scheduled maintainer review when one exists; and
- when a relevant advisory is reported.

The normal developer quality gate may verify lockfile consistency locally but
must not claim current registry vulnerability evidence without reaching the
audit service.

`npm audit --omit=dev` and full audit results must be reported separately.
Production-clean status must not hide a vulnerable build/deploy tool, and a
dev-only finding must not be described as shipped browser code without an
execution-path review.

## Safeguards

- Keep `package-lock.json` committed and deterministic.
- Keep `package.json` private and its engine contract unchanged.
- Preserve exact Wrangler telemetry/log/cache controls in the release runner.
- Do not weaken artifact, CSP, secret-hygiene or source-map checks.
- Do not suppress advisories globally or treat audit exit code as success.
- If a high/critical finding has no compatible fix, stop and record an explicit
  time-bounded exception with owner, exposure, mitigation and revisit trigger.

## Non-goals

- No automatic dependency update service or active GitHub workflow.
- No broad dependency refresh.
- No production deploy.
- No switch from npm or change to Node/npm major versions.
- No source refactor solely because a transitive package changed.
- No deletion of Wrangler or Cloudflare support; dormant-infrastructure scope
  belongs to its own specification.

## Implementation sequence

1. Reproduce both audits from a clean lockfile install.
2. Inspect current dependency paths with `npm explain`.
3. Select the minimal fixed direct-parent versions.
4. Update `package.json` and regenerate the lockfile with Node 22/npm 10.
5. Reinstall cleanly and rerun both audits.
6. Run focused Wrangler, Worker, Vite/CSS and artifact checks.
7. Run the handoff gate and account-free Cloudflare dry-run.
8. Update exact version references in owning operations/decision documents.
9. Record dated audit output without copying mutable advisory status into
   living architecture prose.

## Acceptance checks

```sh
npm ci
npm audit --omit=dev
npm audit
npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/vite-config.test.ts
npm run build
npm run deploy:verify-artifact
npm run deploy:cloudflare:dry-run
npm run docs:check
npm run format:check
git diff --check
```

If the quality/handoff gate split has already landed, also run the proposed
`verify:handoff` script through npm; otherwise run the current
`npm run verify`.

## Done when

- a clean install reports no high or critical production or development
  vulnerability;
- the lockfile change is limited to the reviewed remediation paths;
- Wrangler parses and dry-runs the current Worker/assets configuration;
- build, artifact, Worker and deployment-readiness tests pass;
- no audit failure is hidden or downgraded; and
- living documentation no longer names a stale Wrangler pin.

## Implementation checkpoint

Local dependency ownership has been reproduced: Wrangler owns the installed
Miniflare/Sharp path, Vite owns PostCSS and ESLint/TypeScript-ESLint own the
Brace Expansion path through Minimatch. No dependency was changed.

The sandbox cannot reach the npm audit endpoint. An escalated audit request was
also rejected because it would disclose this private repository's dependency
graph and package metadata to the public npm registry without explicit user
approval. Current advisory evidence is therefore unavailable, so selecting or
installing a fix would be guesswork. Remediation remains
`WAITING_EXTERNAL` until the user approves that disclosure or supplies
equivalent current audit evidence.

## Open questions

- The exact fixed versions are selected at implementation time from the current
  audit and compatibility evidence. The 2026-07-31 audit's suggested Wrangler
  version is evidence, not a permanent version policy.

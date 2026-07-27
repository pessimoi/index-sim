# Testing

- Status: implemented
- Date: 2026-07-27
- Owner: technical testing
- Last verified: 2026-07-27
- Evidence: verified
- Contract: living

This document owns the current repository gate, cross-cutting minimums and
change-type routing. Topic guides own focused commands. Dated results belong in
[testing evidence](../project/testing-evidence.md).

## Authoritative gate

Run the complete repository gate with:

```sh
npm run verify
```

The gate runs type checking, architecture and documentation checks, the unit
and legacy-golden suites, production build and artifact validation, lint,
formatting, dependency audit when network policy permits it, and
`git diff --check`. The implementation is
`scripts/run-cloudflare-release.mjs`; keep this description and the runner in
sync.

Last verified repository results are indexed by the dated
[testing evidence owner](../project/testing-evidence.md). Do not copy its pass
totals, hashes or artifact measurements into this guide.

## Core commands

| Purpose                                      | Command                          |
| -------------------------------------------- | -------------------------------- |
| Type safety                                  | `npm run typecheck`              |
| Layering, cycles and entrypoints             | `npm run architecture:check`     |
| Documentation links, metadata and navigation | `npm run docs:check`             |
| Unit and component tests                     | `npm run test`                   |
| Archived calculation fixtures                | `npm run test:golden`            |
| Production build                             | `npm run build`                  |
| Artifact contract after build                | `npm run deploy:verify-artifact` |
| Lint                                         | `npm run lint`                   |
| Formatting                                   | `npm run format:check`           |
| Patch whitespace                             | `git diff --check`               |

Use `npm run test -- <files>` for a focused Vitest line. A focused pass is
preliminary evidence; delivery still uses the complete gate unless a documented
environment limitation prevents it.

## Detailed guides

- [Domain and integrations](testing/domain-and-integrations.md): simulation,
  planner, schemas, persistence and same-origin integration tests.
- [Runtime, data and deployment](testing/runtime-data-deployment.md): generated
  data, source audits, market artifacts, startup and Cloudflare validation.
- [UI, state and browser](testing/ui-state-and-browser.md): view models,
  controllers, Playwright, accessibility and visual coverage.
- [Manual assistive technology](testing/accessibility-manual.md): the exact
  VoiceOver/Safari and NVDA/browser procedure.

Historical prose removed from these living guides remains reachable through
[testing evidence](../project/testing-evidence.md).

## Change-type minimums

| Change                                        | Minimum validation before the complete gate                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Documentation only                            | `npm run docs:check`, `npm run format:check`, `git diff --check`                              |
| Module boundary, entrypoint or adapter export | `npm run typecheck`, `npm run architecture:check`, focused tests                              |
| Domain formula or simulation result           | Focused domain tests, `npm run test:golden`, numeric paths when affected                      |
| Generated data or source parser               | Generator/data tests, readiness, JSON validation, goldens when values change                  |
| Persistence, migration or transfer            | Focused state/controller tests and the affected browser transaction                           |
| Visible UI workflow                           | Component/view-model tests and the affected Playwright path                                   |
| CSS or screenshot-owned layout                | Relevant browser path and read-only visual comparison                                         |
| Same-origin API or Cloudflare adapter         | Handler/adapter tests and artifact validation; deployed smoke only against an approved origin |

The detailed guides list the focused owners. Add stronger tests before a risky
refactor; do not weaken a gate to make an unrelated change pass.

## Environment and claim boundaries

- Use the repository Node and npm versions declared in `package.json`.
- `npm run dev:checked` is the only supported agent localhost handoff. Its
  `APP_READY` marker, not Vite's listening line, proves application readiness.
- Playwright commands require installed browser binaries. If Chromium is
  missing, install the documented prerequisite before claiming browser evidence.
- Engine-level Firefox and WebKit runs do not prove branded Safari or a physical
  iOS device.
- Automated axe and semantic tests do not prove VoiceOver or NVDA behavior.
- Default automated tests must not call live Hiscores, market or deployment
  providers. Live and deployed evidence needs an explicit approved target and a
  dated evidence entry.
- Darwin visual baselines are local review evidence unless a separate decision
  accepts a remote owner.

## Update rule

When a command, required gate, environment prerequisite or claim boundary
changes, update this page, the affected topic guide, `package.json` and the
release runner in the same change. Record results only in a dated evidence page.

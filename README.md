# 2004scape Combat Simulator

Revision 274

Committed price snapshot captured 12 July 2026

## Quick start

The production app path is the Vite/React rewrite:

Use Node 22 and npm 10. `.nvmrc`, `package.json` and the repository workflow use
the same major-version contract. From a fresh clone:

```sh
nvm use
npm ci
npm run verify
npm run dev
```

Open the local URL printed by Vite. To exercise the production artifact locally:

```sh
npm run build
npm run preview
```

Normal install, verification, build and runtime use committed generated data and
need no `.sources/` checkout, environment variables, Cloudflare credentials or
database. The optional raw game-source checkout is needed only for a reviewed
game revision update; follow the runbook in
[docs/operations/README.md](docs/operations/README.md#game-revision-bump-pr-runbook).

`npm run verify` is the authoritative repository handoff gate. It runs typecheck,
the source dependency-graph architecture check, the full unit and explicit golden
suites, production build and artifact checks, lint, formatting, dependency audit
when network access is available, and `git diff --check`. Browser and visual
suites remain separate because they need a compatible Playwright/browser
environment.

After a production build, verify the D-066 Cloudflare artifact contract with
`npm run deploy:verify-artifact`.

Measure paired cold/warm production startup locally with
`npm run startup:measure`. The command builds, serves and measures the current
artifact with Playwright Chromium; it is workstation evidence rather than a
universal latency SLA. The release gate separately enforces deterministic entry
JavaScript byte budgets.

The accepted production target is one Cloudflare Worker with Static Assets.
Cloudflare Builds should run `npm run deploy:cloudflare:build` for `master`, then
`npm run deploy:cloudflare`; non-production versions use
`npm run deploy:cloudflare:preview`. Account connection and deployed smoke
evidence are future-adopter operations required only before claiming a public
instance; they are not repository setup requirements under D-067.

The old browser runtime is archived at `legacy/index.html` for reference and parity work. It is not the production entrypoint.

## Documentation

- AI-agent work guide: [AGENTS.md](AGENTS.md)
- Documentation map: [docs/README.md](docs/README.md)
- Rewrite architecture notes: [docs/technical/architecture.md](docs/technical/architecture.md)

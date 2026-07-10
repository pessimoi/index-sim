# 2004scape Combat Simulator

Revision 274

Prices updated 3 July 2026

## Run

The production app path is the Vite/React rewrite:

Use Node 22 and npm 10; `.nvmrc`, `package.json` and the repository workflow use
the same major-version contract.

```sh
npm run dev
npm run build
npm run preview
```

After a production build, verify the D-066 Cloudflare artifact contract with
`npm run deploy:verify-artifact`.

The accepted production target is one Cloudflare Worker with Static Assets.
Cloudflare Builds should run `npm run deploy:cloudflare:build` for `master`, then
`npm run deploy:cloudflare`; non-production versions use
`npm run deploy:cloudflare:preview`. Account connection and deployed smoke
evidence are still required before claiming a public release.

The old browser runtime is archived at `legacy/index.html` for reference and parity work. It is not the production entrypoint.

## Documentation

- AI-agent work guide: [AGENTS.md](AGENTS.md)
- Documentation map: [docs/README.md](docs/README.md)
- Rewrite architecture notes: [docs/technical/architecture.md](docs/technical/architecture.md)

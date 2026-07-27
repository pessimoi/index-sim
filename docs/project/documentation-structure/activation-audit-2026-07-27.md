# DOCS-01 activation audit 2026-07-27

- Status: historical
- Date: 2026-07-27
- Owner: project documentation
- Evidence: verified
- Contract: closed

This snapshot records the repository immediately before the DOCS-01 program
documents and implementation tooling were added. The numbers below are dated
activation evidence and must not be copied into living architecture, testing,
operations or planning documents as current facts.

## Baseline inventory

- The `docs/` tree contained 144 Markdown files: 104 under `docs/technical`,
  including 95 technical `*-spec.md` files.
- The documentation contained approximately 363,000 words, approximately
  270,000 of them under `docs/technical`.
- The root map contained 195 list items and 238 local links.
- Links in the root map overlapped 95 percent with the technical index and
  89 percent with the project index.
- The technical index omitted 19 technical documents. The generated revision
  impact report had no inbound Markdown link.
- The in-scope specification set contained 101 files and 77 distinct free-form
  status values. Two status syntaxes were in use; 32 files had an explicit
  date field and 42 had an explicit owner field.
- The living architecture page described a graph snapshot with 149 source
  modules and 134 client-reachable modules. The repository architecture check
  produced a different dated graph result, demonstrating the drift mechanism.

## Preserved strengths

The activation scan found no broken local Markdown file links or heading
anchors. Every one of the 41 distinct documented `npm run` command names was
present in `package.json`.

## Collection method

The inventory used read-only `rg`, Node filesystem reads and the repository's
architecture command. Local inline Markdown targets and GitHub-style heading
anchors were resolved without external requests. Package-command references
were compared with the `scripts` object in `package.json`.

The implementation replaces this one-off scan with `npm run docs:check`. The
checker reports repository-relative diagnostics and writes no files.

# Documentation navigation and consistency-check specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project documentation and repository tooling
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Turn the root documentation map into a short routing page, make section indexes
complete and add one read-only local consistency check.

## Navigation contract

1. `docs/README.md` links to documentation owners and section indexes, not to
   every technical specification.
2. `docs/technical/README.md` owns the grouped technical catalog.
3. `docs/project/README.md` owns current planning, goals, decisions, evidence
   and generated-report routing.
4. `docs/product/README.md` and `docs/operations/README.md` remain their section
   entrypoints.
5. Every Markdown document under `docs/` must be reachable from
   `docs/README.md` through section indexes. Generated reports may be three
   links deep; other documents may be at most two links deep.
6. The root map must not repeat section catalogs or feature-level ownership
   rules already owned by architecture, testing or specification catalogs.

## `docs:check` contract

Add a repository-local `docs:check` package script with focused tests. It must
fail on:

- a broken repository-relative Markdown file link;
- a broken local Markdown heading anchor;
- a documented `npm run` command missing from `package.json`;
- a document unreachable under the navigation contract;
- missing or invalid metadata from the metadata specification;
- duplicate catalog entries or a catalog entry whose status disagrees with
  document metadata; and
- configured volatile facts outside their allowed current/evidence owner.

The check must ignore external URL availability, avoid network requests, emit
repository-relative diagnostics and write no files. Add it to `npm run verify`
after its focused tests are green. This is a local repository gate, not a CI
provider or remote merge-policy decision.

## Migration requirements

1. Replace the root map's flat specification list with concise Product,
   Technical, Operations and Project routes.
2. Replace the long root ownership bullet list with a short owner table and
   links to the detailed technical/project catalogs.
3. Add the 19 currently missing technical entries to the grouped technical
   catalog through metadata-driven or checker-enforced maintenance.
4. Add an inbound route for `docs/project/revision-impact/current.md` through a
   generated-report index.
5. Preserve every valid existing link while reorganizing indexes.

## Non-goals

- Do not install a documentation site generator.
- Do not require external link crawling.
- Do not move the 95 technical specifications in this work package.
- Do not activate GitHub Actions or choose a remote CI owner.

## Done when

- the root map is a concise owner-level entrypoint;
- every document is reachable and appears in exactly one owning catalog;
- the technical and project indexes do not silently omit new documents;
- all current local links, anchors and npm-command references pass; and
- `npm run verify` includes the deterministic read-only check.

## Implementation evidence

- The root map is an owner-level router. Technical specifications, goals,
  testing evidence, generated reports, audits and DOCS-01 each have a bounded
  catalog route.
- `npm run docs:check` validates local files and anchors, package commands,
  reachability depth, metadata, lifecycle catalog agreement and volatile-fact
  ownership without network or writes.
- The release runner invokes the documentation gate as part of `npm run
verify`.
- The complete local documentation graph passes the implemented check.

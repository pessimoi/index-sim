# Living architecture owner specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: technical architecture documentation
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Make `docs/technical/architecture.md` a concise description of the current
system and enforced boundaries instead of a combined architecture map,
implementation diary, measurement log and completed rewrite plan.

## Required structure

The rewritten living owner must contain:

1. system context and production/legacy entrypoints;
2. current source-area ownership by stable directory or public boundary;
3. enforced dependency directions and the command that validates them;
4. runtime bootstrap, persistence, Worker and same-origin integration
   boundaries;
5. generated-data, market and deployment ownership links;
6. current risk boundaries; and
7. links to accepted decisions for genuinely open architecture choices.

## Content migration

- Convert the already achieved `Target rewrite architecture` into the current
  source-area description and remove future-tense stack recommendations that
  merely describe the implemented stack.
- Remove `Current rewrite extraction status` as a feature-by-feature
  implementation ledger. Completed contracts remain in their specifications.
- Remove test totals, module counts, file lengths, artifact sizes, hashes and
  workstation measurements from the living owner.
- Keep archived legacy script order in a small linked reference section or a
  dedicated `docs/technical/architecture/legacy-reference.md` if the main
  document cannot remain concise.
- Deduplicate open questions. In particular, quest-state representation and
  D-051 fallback removal must be one decision boundary, not two questions.
- Link to the current architecture audit as dated evidence without calling its
  counts current.

## Size and readability target

The main architecture document should stay below 3,500 words unless a later
accepted architecture decision demonstrates that a larger living owner is
necessary. Prefer short tables and bounded paragraphs over multi-thousand-
character bullets.

## Non-goals

- Do not change imports, module boundaries, entrypoints or deployment shape.
- Do not create a second architecture truth source.
- Do not delete completed specifications or historical audits.
- Do not use generated diagrams that require an external renderer to read the
  architecture.

## Validation

- Run `npm run architecture:check` and confirm the document states its policy,
  not a copied graph result.
- Run focused searches for removed counts, duplicate questions and future-tense
  rewrite claims.
- Run the implemented `docs:check` package script, formatting and
  `git diff --check`.

## Done when

- a maintainer can identify current entrypoints, layers and integration
  boundaries without reading implementation history;
- no stale current count or artifact measurement remains;
- completed feature work is linked rather than restated;
- every open architecture question maps to the decision owner; and
- the repository architecture check remains unchanged and green.

## Implementation evidence

- [Architecture](../../technical/architecture.md) is now a concise current
  owner covering system context, entrypoints, source ownership, dependency
  policy, bootstrap, calculation, persistence, generated data, prices,
  integrations, deployment, legacy boundaries, risks and decision links.
- Target-rewrite diaries, extraction history, graph totals, file lengths,
  artifact measurements and workstation evidence were removed.
- The owner is below the specification's word ceiling and points to the
  architecture command for the live graph.
- Architecture and documentation checks pass without a source-boundary change.

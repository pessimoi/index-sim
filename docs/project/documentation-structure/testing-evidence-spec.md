# Testing truth and dated evidence specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: technical testing documentation and project evidence
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Keep current test commands and coverage routing easy to find while retaining
all dated pass/fail, count, hash and browser evidence in one historical path.

## Ownership contract

- `docs/technical/testing.md` owns the authoritative gate, cross-cutting
  minimums, environment prerequisites and change-type routing.
- `docs/technical/testing/*.md` owns current topic-specific commands, coverage
  boundaries and interpretation.
- `docs/project/testing-evidence.md` remains the stable evidence entrypoint.
- Dated run results live under a month- or release-bounded evidence page linked
  by that entrypoint.
- Completed specifications may preserve their own activation evidence, but it
  is never called the latest repository result.

## Requirements

1. Remove hashes, artifact totals, module/test counts and dated pass matrices
   from living testing guides unless they define a durable budget or invariant.
2. Replace the current `Current state` matrix with a short `Last verified`
   pointer to the newest evidence entry and the authoritative gate command.
3. Move existing dated evidence from living topic guides into the evidence
   path without losing dates, failures, platform limits or baseline-review
   context.
4. Split the 1,400-line evidence log into bounded chronological files while
   retaining `docs/project/testing-evidence.md` as its stable index.
5. Keep browser-engine, branded-Safari, physical-device, accessibility and live
   provider claim boundaries explicit in both command guidance and evidence.
6. Remove duplicated latest-result prose from backlog, operations and feature
   inventory; link to the testing owner instead.
7. Make `docs:check` reject a configured pass-count/hash pattern in living
   testing pages, with explicit exceptions for durable budgets.

## Non-goals

- Do not change test commands, Playwright projects, baselines or coverage.
- Do not run live upstreams or claim manual evidence.
- Do not delete old failures, workstation measurements or artifact hashes.
- Do not choose a CI provider or promote Darwin images to a remote gate.

## Validation

- Resolve all links after evidence extraction.
- Verify every concrete documented npm command against `package.json`.
- Search living guides for dated pass totals, hashes and mutable artifact
  measurements.
- Run the implemented `docs:check` package script, formatting and
  `git diff --check`.

## Done when

- current commands have one technical owner;
- dated results have one navigable historical route;
- no living guide competes with the evidence index for mutable results;
- platform and manual-evidence limits remain intact; and
- no tests, fixtures, baselines or runtime source changed.

## Implementation evidence

- [Testing](../../technical/testing.md) and its focused guides now contain only
  current commands, coverage routing, prerequisites and claim boundaries.
- The stable [testing evidence index](../testing-evidence.md) routes bounded
  chronological pages. Former living-guide matrices and narratives remain in
  explicitly historical snapshots without loss.
- Branded Safari, physical-device, VoiceOver/NVDA, deployed-origin and live
  provider boundaries remain unclaimed.
- Documentation, formatting and link checks pass; no test configuration,
  browser project or baseline was changed.

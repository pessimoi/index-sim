# Technical specification lifecycle catalog specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: technical documentation
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Make active technical contracts distinguishable from completed implementation
evidence without a high-churn move of 95 existing specification files.

## Lifecycle classes

The technical catalog must derive these groups from canonical metadata:

- `Active contracts`: specced or active work that can authorize changes.
- `Living contracts`: implemented documents that still own a continuing
  compatibility, product/API or release boundary.
- `Implemented evidence`: completed implementation contracts retained for
  rationale and regression history.
- `Superseded or historical`: documents replaced by a named later owner.

`Status` remains canonical; a separate `Contract: living | closed` field may be
added if implemented documents need to distinguish ongoing authority from
closed evidence. Do not infer this distinction from the word “implemented” in
free-form prose.

## Requirements

1. Classify all 95 technical `*-spec.md` files explicitly.
2. Add one grouped specification catalog linked from
   `docs/technical/README.md`.
3. Keep the technical README focused on current architecture, testing, active
   contracts and the catalog instead of listing every specification inline.
4. Each catalog row contains title, canonical status, contract class, owner,
   last verified/implemented date and parent goal or decision when present.
5. Completed specifications retain activation-time counts and evidence, but
   their header and catalog must make clear that those values are historical.
6. Superseded specifications name their replacement and cannot appear as active.
7. Add checker coverage for an unclassified spec, duplicate catalog entry,
   status/class conflict and missing replacement link.

## Physical path policy

Do not move specification files during DOCS-01. The existing relative-link
graph is broad, and some paths may be referenced from scripts, tests, audit
snapshots or external review notes. A later physical archive requires a
separate specification with a complete inbound-link inventory and external-link
compatibility decision.

## Non-goals

- Do not reopen completed product work merely because its specification is
  retained.
- Do not delete implementation evidence or collapse distinct contracts into
  one large file.
- Do not use filename prefixes as lifecycle truth.
- Do not modify runtime code, schemas or tests to match historical prose.

## Done when

- every technical specification appears in exactly one lifecycle group;
- active/living contracts are visible without scanning implemented evidence;
- the technical README no longer duplicates the full catalog;
- status, class and replacement links pass `docs:check`; and
- no mass file move or historical-evidence loss occurred.

## Implementation evidence

- [The specification catalog](../../technical/specifications.md) classifies
  every technical `*-spec.md` file into active, living, implemented or
  superseded/historical ownership directly from canonical metadata.
- At this dated closeout the catalog contains 27 living contracts and 68 closed
  implemented-evidence contracts; no technical contract is unclassified or
  duplicated.
- The checker rejects group, status or contract disagreement and missing or
  duplicate catalog entries.
- No specification file was physically moved.

# Documentation structure hardening program

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project documentation
- Evidence: verified
- Contract: living

- Executable goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Source: repository-wide documentation structure audit on 2026-07-27

## Purpose

Reduce documentation drift and navigation cost without deleting historical
evidence or changing product/runtime behavior. The program keeps the existing
`product`, `technical`, `operations` and `project` ownership split, but makes
the current truth, executable work and dated evidence visibly different.

## Activation evidence

The dated [DOCS-01 activation inventory](activation-audit-2026-07-27.md)
records the pre-program file, navigation, metadata and volatile-fact baseline.
Its measurements are historical evidence, not current repository claims. Run
`npm run docs:check` for the current documentation graph and metadata result.

## Work packages

| Order | Specification                                                         | Required outcome                                                               | Depends on   |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| 1     | [Current facts and drift control](current-facts-spec.md)              | One owner for volatile facts; no stale current counts in architecture          | None         |
| 2     | [Metadata contract](metadata-spec.md)                                 | Machine-checkable lifecycle, owner and evidence fields                         | Package 1    |
| 3     | [Navigation and consistency checks](navigation-spec.md)               | Short root map, complete grouped indexes and local `docs:check`                | Packages 1-2 |
| 4     | [Living architecture owner](architecture-owner-spec.md)               | Concise current architecture without implementation diary content              | Packages 1-3 |
| 5     | [Testing truth and dated evidence](testing-evidence-spec.md)          | Commands and evidence separated without losing history                         | Packages 1-3 |
| 6     | [Technical specification lifecycle](technical-spec-lifecycle-spec.md) | Active and completed specifications are distinguishable without mass moves     | Packages 2-3 |
| 7     | [Project memory structure](project-memory-spec.md)                    | Current planning, generated reports and historical evidence are clearly routed | Packages 2-6 |

## Shared invariants

Every work package must:

- preserve unrelated and pre-existing worktree changes;
- retain the four top-level documentation ownership areas;
- keep runtime code, formulas, data, schemas, providers, deployment shape and
  browser persistence unchanged;
- preserve historical evidence with its original date and context;
- avoid presenting a dated run as current repository truth;
- update every repository-relative link and hard-coded documentation path it
  changes;
- avoid choosing a CI provider or remote merge policy; and
- leave generated report contents under their existing generator ownership.

Physical movement of the 95 technical specifications or generator-owned
reports is deliberately outside this program. First establish metadata,
catalogs and checks; a later move needs a separate link-churn and external-link
compatibility decision.

## Program completion

The program is complete only when all seven specifications are implemented,
their individual checks pass, the root and section indexes agree, current
facts have one owner, dated evidence has one historical route and `DOCS-01`
records final validation evidence.

## Implementation outcome

All seven work packages are implemented. The final repository gate and the
earlier isolated timeout/rerun context are recorded in
[testing evidence](../testing-evidence/2026-07-27.md). No runtime, generated
data, provider, persistence, deployment-shape or visual-baseline change was
made by this program.

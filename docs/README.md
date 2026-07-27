# Documentation map

- Status: implemented
- Date: 2026-07-27
- Owner: documentation governance
- Last verified: 2026-07-27
- Evidence: verified
- Contract: living

Use this page to choose the owning documentation area. It is intentionally not a
feature or specification catalog.

## Area entrypoints

| Area       | Owns                                                          | Entrypoint                                     |
| ---------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Product    | Domain concepts, supported workflows and product scope        | [Product and domain](product/README.md)        |
| Technical  | Current architecture, validation and implementation contracts | [Technical documentation](technical/README.md) |
| Operations | Run, build, deploy and maintenance procedures                 | [Operations](operations/README.md)             |
| Project    | Current planning, decisions, evidence and history             | [Project memory](project/README.md)            |

## Owner-level catalogs

- [Technical specification catalog](technical/specifications.md): active,
  living, implemented and historical specification classes.
- [Executable goals](project/goals/README.md): active programs first, completed
  PF/RP goals as historical execution evidence.
- [Testing evidence](project/testing-evidence.md): dated repository, browser,
  artifact and failure-triage snapshots.
- [Generated evidence](project/generated-evidence.md): generator-owned reports
  and exact commands.
- [Audit and release evidence](project/audit-evidence.md): dated reviews,
  delivery records and legacy audit snapshots.
- [DOCS-01 documentation structure program](project/documentation-structure/README.md):
  governance specifications and activation evidence.

These catalogs are linked directly so ordinary documents remain at most two
links from this map and generated reports at most three.

## Current truth owners

| Question                                 | Owner                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| What does the product support?           | [Product overview](product/README.md) and [feature inventory](product/feature-inventory.md)       |
| How is the current system structured?    | [Architecture](technical/architecture.md)                                                         |
| Which checks should run?                 | [Testing](technical/testing.md)                                                                   |
| How is the app run or deployed?          | [Operations](operations/README.md)                                                                |
| What work is current?                    | [Backlog](project/backlog.md), [roadmap](project/roadmap.md) and [goals](project/goals/README.md) |
| Which decisions are accepted or open?    | [Decision log](project/decisions.md)                                                              |
| What did a dated run or audit find?      | [Testing evidence](project/testing-evidence.md) and [audit evidence](project/audit-evidence.md)   |
| What do generated snapshots contain now? | Committed JSON/source-pin files and [generated evidence](project/generated-evidence.md)           |

If documentation and runtime behavior disagree, treat code and validated data as
current truth, then correct the owning document. Do not promote dated counts,
hashes or audit conclusions into living current-state claims.

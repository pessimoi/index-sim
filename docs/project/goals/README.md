# Executable goals

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project execution planning
- Evidence: verified
- Contract: living

Goal files turn accepted specifications into bounded implementation sequences.
Parent specifications remain requirement truth; goals own ordering, concrete
starting points, required checks and documentation transitions.

## Active programs

No execution program is active.

## Completed documentation-governance goals

- [DOCS-01 · Documentation structure hardening](docs-01-documentation-structure-hardening.md)
  implements the
  [seven-part documentation structure program](../documentation-structure/README.md).

## Completed product-finishing goals

- [PF-01 · Consistent result rate semantics](pf-01-result-rate-semantics.md)
- [PF-02 · Disambiguate colliding entity labels](pf-02-entity-label-collisions.md)
- [PF-03A · Setup transfer diff core and file review](pf-03a-setup-transfer-diff-core.md)
- [PF-03B · Shared-link and saved-row change review](pf-03b-setup-transfer-review-surfaces.md)
- [PF-04 · Protect session-only work before exit](pf-04-session-only-exit-protection.md)
- [PF-05 · Clarify transfer artifacts and filenames](pf-05-transfer-artifact-clarity.md)
- [PF-06 · Workbench browser history and context](pf-06-workbench-history-context.md)

## Completed release-polish goals

- [RP-01 · Workspace backup discoverability](rp-01-workspace-backup-discoverability.md)
- [RP-02 · Visible action feedback](rp-02-visible-action-feedback.md)
- [RP-03 · Mobile MonsterCard navigation loop](rp-03-mobile-monstercard-loop.md)
- [RP-04 · Recommendation and optimizer Undo](rp-04-recommendation-optimizer-undo.md)
- [RP-05 · Wide table discoverability](rp-05-wide-table-discoverability.md)
- [RP-06 · Hiscores fallback readability](rp-06-hiscores-fallback-readability.md)

The completed files preserve their own dated implementation evidence. Current
commands remain in [technical testing](../../technical/testing.md), and mutable
results remain in [testing evidence](../testing-evidence.md).

## Standard execution contract

Every executor must:

1. inspect `git status --short` and preserve unrelated changes;
2. read `AGENTS.md`, the root and documentation maps, architecture, testing,
   the parent specification and the goal;
3. verify current code and tests with `rg`;
4. keep work inside the parent scope and stop for a new provider, backend,
   database, auth, deployment or persistence decision;
5. add focused regression coverage when behavior changes;
6. run focused checks before the broader required gate;
7. update living documentation only after evidence exists;
8. keep unrun manual, browser, provider and deployment evidence explicitly
   unrun; and
9. avoid commit, push or baseline writes unless the user authorizes them.

Completion reports list outcomes, changed owners, executed checks, unrun
evidence, preserved boundaries and remaining blockers.

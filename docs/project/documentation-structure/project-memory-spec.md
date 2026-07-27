# Project memory structure specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project documentation
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Make current planning lightweight while preserving completed goals, generated
reports, audits and delivery evidence as clearly labelled history.

## Project-memory classes

- `Current planning`: roadmap, open/specced/active backlog, decisions, bug
  triage and idea inbox.
- `Execution goals`: active goals first, completed goal programs grouped below.
- `Generated evidence`: Planner parity, revision impact, numeric-path and NPC
  source reports with their generator ownership.
- `Audit and release evidence`: architecture, security, code, documentation,
  maintainability, testing and worktree-delivery records.
- `History`: completed backlog cards and superseded planning snapshots.

## Requirements

1. Rewrite `docs/project/README.md` as a grouped routing page for the five
   classes above.
2. Keep `docs/project/decisions.md` at its stable path and preserve every D-id
   anchor. Do not split it during DOCS-01.
3. Keep only `Open`, `Specced`, `Active`, `Ongoing`, `Blocked` and `Conditional`
   work in the current backlog. Move completed cards to a dated
   `backlog-history.md` owner without changing their evidence wording.
4. Update `docs/project/goals/README.md` so active programs are first and
   completed PF/RP programs remain clearly historical execution evidence.
5. Add bounded generated-evidence and audit-evidence indexes. Keep existing
   generator-owned report paths stable during this goal.
6. Ensure every generated report, including revision impact, has an inbound
   link and exact generator metadata.
7. Remove “current” wording from dated audit descriptions unless the audit is
   explicitly refreshed by a repository-wide review.
8. Link current testing results through the testing-evidence entrypoint instead
   of copying counts into completed backlog summaries.

## Non-goals

- Do not rewrite decision rationale or renumber decisions.
- Do not regenerate reports or change generator output paths.
- Do not delete completed goals, audits or delivery evidence.
- Do not promote ideas to backlog or reopen completed feature work.
- Do not physically move generator-owned reports in this program.

## Done when

- project README exposes current planning before history;
- current backlog contains no completed implementation archive;
- completed cards remain reachable in one dated history owner;
- active and completed goals are visually separate;
- generated reports and audits have explicit grouped routes;
- decisions retain stable IDs and paths; and
- all links, metadata, formatting and `docs:check` pass.

## Implementation evidence

- [Project memory](../README.md) now presents current planning, execution
  goals, evidence indexes and retained history as separate groups.
- Completed backlog cards and feature completion notes moved without wording
  loss to dedicated history owners; the living backlog contains only accepted
  current status classes.
- Generated and audit/release indexes route every report, including revision
  impact, while generator-owned paths remain stable.
- Decision-log paths and D-id anchors were not changed. Documentation and link
  checks pass.

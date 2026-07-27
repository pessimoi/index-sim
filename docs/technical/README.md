# Technical documentation

- Status: implemented
- Date: 2026-07-27
- Owner: technical documentation
- Last verified: 2026-07-27
- Evidence: verified
- Contract: living

## Current owners

- [Architecture](architecture.md): system context, entrypoints, source
  ownership, dependency rules, bootstrap, persistence, integrations and
  deployment shape.
- [Testing](testing.md): authoritative gate, cross-cutting minimums,
  environment boundaries and change-type routing.
- [Technical specification catalog](specifications.md): lifecycle classification
  for every technical `*-spec.md` file.

## Focused testing routes

- [Domain and integrations](testing/domain-and-integrations.md)
- [Runtime, data and deployment](testing/runtime-data-deployment.md)
- [UI, state and browser](testing/ui-state-and-browser.md)
- [Manual assistive technology](testing/accessibility-manual.md)

Current commands belong in these guides. Historical results do not.

## Supporting technical evidence

- [Rewrite parity report](rewrite-parity-report.md): dated accepted
  legacy-versus-rewrite classification.
- [Large-module structural split assessment](large-module-structural-split-assessment.md):
  dated retention-trigger assessment.
- [Former testing current-state snapshot](testing-current-state-history-2026-07.md):
  historical matrix removed from the living testing owner.
- [Former topic-guide evidence](testing/historical-evidence-2026-07.md):
  historical measurements and outcomes removed from focused guides.

Dated execution results are indexed in
[project testing evidence](../project/testing-evidence.md). Audit snapshots are
indexed in [audit evidence](../project/audit-evidence.md). They do not override
the current architecture or testing owners.

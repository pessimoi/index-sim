# Technical documentation

## Start here

- [architecture.md](architecture.md): current architecture, target rewrite architecture and module boundaries.
- [rewrite-spec.md](rewrite-spec.md): implementation-grade rewrite specification.
- [rewrite-parity-report.md](rewrite-parity-report.md): current legacy-vs-rewrite calculation reliability audit.
- [ui-parity-spec.md](ui-parity-spec.md): legacy-to-rewrite UI layout, tab order and workflow parity target.
- [legacy-planner-parity-spec.md](legacy-planner-parity-spec.md): implemented archived Planner behavior comparison and gap-classification contract.
- [shareable-setup-permalink-spec.md](shareable-setup-permalink-spec.md): static, review-before-load setup sharing contract.
- [visual-regression-spec.md](visual-regression-spec.md): deterministic Playwright screenshot coverage and baseline policy.
- [live-integrations-spec.md](live-integrations-spec.md): hiscores lookup and live market sync product/API specification.
- [hiscores-live-implementation-spec.md](hiscores-live-implementation-spec.md): implemented Hiscores provider/runtime contract and adopter live-evidence runbook.
- [testing.md](testing.md): current validation commands and future test strategy.

## Related evidence

- [../../ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md): detailed architecture audit snapshot.
- [../../PROJECT_REVIEW_NOTES.md](../../PROJECT_REVIEW_NOTES.md): file-by-file review findings.
- [../../SECURITY_AUDIT.md](../../SECURITY_AUDIT.md): security audit snapshot.

## Current validation commands

The repo has package scripts for the rewrite scaffold and golden fixtures. See [testing.md](testing.md) for the current commands and when to run each one.

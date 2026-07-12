# Technical documentation

## Start here

- [architecture.md](architecture.md): current architecture, target rewrite architecture and module boundaries.
- [rewrite-spec.md](rewrite-spec.md): implementation-grade rewrite specification.
- [rewrite-parity-report.md](rewrite-parity-report.md): current legacy-vs-rewrite calculation reliability audit.
- [ui-parity-spec.md](ui-parity-spec.md): legacy-to-rewrite UI layout, tab order and workflow parity target.
- [hit-distribution-visualization-spec.md](hit-distribution-visualization-spec.md): implemented discrete normal-versus-special hit-distribution comparison contract.
- [legacy-planner-parity-spec.md](legacy-planner-parity-spec.md): implemented archived Planner behavior comparison and gap-classification contract.
- [risk-variability-spec.md](risk-variability-spec.md): accepted kill, food, trip, timed-GP and target-probability distribution contract.
- [source-backed-incoming-damage-spec.md](source-backed-incoming-damage-spec.md): proposed typed NPC attack-profile and shared Trip/Risk incoming-damage contract.
- [source-backed-casket-valuation-spec.md](source-backed-casket-valuation-spec.md): implemented Revision 274 ordinary-casket opened-content valuation and source-drift contract.
- [per-item-price-provenance-freshness-spec.md](per-item-price-provenance-freshness-spec.md): implemented item-level price origin, observation/evaluation time, scheduled sidecar, persistence migration and history-v2 contract.
- [dynamic-loot-market-dependency-coverage-spec.md](dynamic-loot-market-dependency-coverage-spec.md): implemented Trip-derived market dependency inventory and generated-runtime coverage audit for every active tagged loot table.
- [high-impact-dynamic-loot-market-allowlist-spec.md](high-impact-dynamic-loot-market-allowlist-spec.md): implemented source-reviewed twelve-item market expansion for identified gem/mega and ultra-rare dependencies, leaving only ten unsupported unidentified herbs unmapped.
- [shareable-setup-permalink-spec.md](shareable-setup-permalink-spec.md): static, review-before-load setup sharing contract.
- [visual-regression-spec.md](visual-regression-spec.md): deterministic Playwright screenshot coverage and baseline policy.
- [live-integrations-spec.md](live-integrations-spec.md): hiscores lookup and live market sync product/API specification.
- [hiscores-live-implementation-spec.md](hiscores-live-implementation-spec.md): implemented Hiscores provider/runtime contract and adopter live-evidence runbook.
- [testing.md](testing.md): current validation commands and future test strategy.

## Related evidence

- [../project/npc-attack-source-audit.md](../project/npc-attack-source-audit.md): generated Revision 274 NPC attack-handler coverage and open decision package.
- [../../ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md): detailed architecture audit snapshot.
- [../../PROJECT_REVIEW_NOTES.md](../../PROJECT_REVIEW_NOTES.md): file-by-file review findings.
- [../../SECURITY_AUDIT.md](../../SECURITY_AUDIT.md): security audit snapshot.

## Current validation commands

The repo has package scripts for the rewrite scaffold and golden fixtures. See [testing.md](testing.md) for the current commands and when to run each one.

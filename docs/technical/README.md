# Technical documentation

## Start here

- [architecture.md](architecture.md): current architecture, target rewrite architecture and module boundaries.
- [rewrite-spec.md](rewrite-spec.md): implementation-grade rewrite specification.
- [rewrite-parity-report.md](rewrite-parity-report.md): current legacy-vs-rewrite calculation reliability audit.
- [ui-parity-spec.md](ui-parity-spec.md): legacy-to-rewrite UI layout, tab order and workflow parity target.
- [bounded-loadout-optimizer-spec.md](bounded-loadout-optimizer-spec.md): implemented bounded visible-catalog loadout search and no-regression contract.
- [duel-setup-diff-spec.md](duel-setup-diff-spec.md): implemented setup-diff and calculated-impact comparison contract.
- [stats-source-distribution-spec.md](stats-source-distribution-spec.md): implemented special/cannon source distribution contract.
- [conditional-quest-clue-loot-spec.md](conditional-quest-clue-loot-spec.md): implemented source eligibility and zero-calculation contract for conditional loot.
- [conditional-loot-presentation-spec.md](conditional-loot-presentation-spec.md): D-089 grouped inactive quest/clue loot presentation without calculation changes.
- [manual-item-price-overrides-spec.md](manual-item-price-overrides-spec.md): D-090 browser-local per-item price overlay and reset contract.
- [requirement-aware-loadout-optimizer-spec.md](requirement-aware-loadout-optimizer-spec.md): implemented checked-by-default numeric-level eligibility for the bounded loadout optimizer.
- [hit-distribution-visualization-spec.md](hit-distribution-visualization-spec.md): implemented discrete normal-versus-special hit-distribution comparison contract.
- [legacy-planner-parity-spec.md](legacy-planner-parity-spec.md): implemented archived Planner behavior comparison and gap-classification contract.
- [legacy-migration-layer-refactor-spec.md](legacy-migration-layer-refactor-spec.md): ownership-only move of legacy-to-rewrite mapping from the generic storage adapter into app state.
- [app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md): phased, behavior-preserving extraction of shared UI, browser-state controllers and feature panes from the rewrite composition root.
- [metric-list-presenter-hygiene-spec.md](metric-list-presenter-hygiene-spec.md): implemented generic-presenter ownership and component-API cleanup completed before controller extraction.
- [runtime-bootstrap-controller-spec.md](runtime-bootstrap-controller-spec.md): implemented generated-runtime lifecycle, compatibility and startup PriceSet resolution extraction preserving the D-094 chunk boundary.
- [local-state-recovery-controller-spec.md](local-state-recovery-controller-spec.md): implemented browser-state health/block/persist/clear orchestration and pure Settings recovery panel boundary.
- [hiscores-lookup-controller-spec.md](hiscores-lookup-controller-spec.md): implemented request-race-safe Hiscores lifecycle extraction and topbar panel boundary.
- [setup-file-transfer-controller-spec.md](setup-file-transfer-controller-spec.md): implemented bounded rewrite setup import/export orchestration and typed caller-owned Apply boundary.
- [price-set-transfer-controller-spec.md](price-set-transfer-controller-spec.md): implemented PriceSet import/acceptance/export/reset transaction extraction with typed caller-owned runtime application.
- [cannon-pane-extraction-spec.md](cannon-pane-extraction-spec.md): implemented first low-coupling feature-pane extraction with explicit calculated presentation and action props.
- [startup-bundle-performance-spec.md](startup-bundle-performance-spec.md): measured cold/warm startup, deterministic entry-JavaScript budgets and generated-runtime bootstrap splitting.
- [risk-variability-spec.md](risk-variability-spec.md): implemented kill, food, trip, timed-GP and target-probability distribution contract.
- [source-backed-incoming-damage-spec.md](source-backed-incoming-damage-spec.md): implemented typed NPC attack-profile and shared Trip/Risk incoming-damage contract.
- [source-backed-requirements-npc-size-spec.md](source-backed-requirements-npc-size-spec.md): implemented generated numeric item requirements and NPC-size contract.
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

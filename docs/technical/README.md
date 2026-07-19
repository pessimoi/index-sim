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
- [contextual-item-price-correction-spec.md](contextual-item-price-correction-spec.md): implemented direct Result/Loot/Economy path to the existing manual-price editor.
- [requirement-aware-loadout-optimizer-spec.md](requirement-aware-loadout-optimizer-spec.md): implemented checked-by-default numeric-level eligibility for the bounded loadout optimizer.
- [hit-distribution-visualization-spec.md](hit-distribution-visualization-spec.md): implemented discrete normal-versus-special hit-distribution comparison contract.
- [legacy-planner-parity-spec.md](legacy-planner-parity-spec.md): implemented archived Planner behavior comparison and gap-classification contract.
- [legacy-migration-layer-refactor-spec.md](legacy-migration-layer-refactor-spec.md): ownership-only move of legacy-to-rewrite mapping from the generic storage adapter into app state.
- [legacy-migration-internal-split-spec.md](legacy-migration-internal-split-spec.md): implemented responsibility split of the app-owned legacy migration facade, inspectors, setup mapper and focused tests without changing migration policy.
- [app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md): phased, behavior-preserving extraction of shared UI, browser-state controllers and feature panes from the rewrite composition root.
- [app-composition-root-phase4-spec.md](app-composition-root-phase4-spec.md): implemented D-093 Phase 4 final extraction of pure root-shell and legacy-review presentation plus bounded helper ownership cleanup while App retains browser state, effects and multi-feature transactions.
- [app-composition-root-retention-spec.md](app-composition-root-retention-spec.md): implemented ARCH-2026-03 retention contract, verified App ownership inventory and evidence-based triggers for any future feature-specific extraction.
- [stats-loadout-pane-refactor-spec.md](stats-loadout-pane-refactor-spec.md): implemented D-093 extraction of Stats/Loadout panes and their feature view-model owners while App retains live state and orchestration.
- [compare-duel-pane-refactor-spec.md](compare-duel-pane-refactor-spec.md): implemented D-093 Phase 3C extraction of Compare/Duel panes, direct feature view-model owners and their existing calculation lifecycles.
- [planner-pane-refactor-spec.md](planner-pane-refactor-spec.md): implemented D-093 Phase 3D extraction of the Planner pane, direct feature view-model and explicit-Recompute calculation lifecycle.
- [risk-pane-refactor-spec.md](risk-pane-refactor-spec.md): implemented D-093 Phase 3E extraction of the Risk pane, direct Risk UI contracts and explicit Run/Cancel analysis lifecycle.
- [loot-trip-pane-refactor-spec.md](loot-trip-pane-refactor-spec.md): implemented D-093 Phase 3F extraction of the Loot and Trip panes, direct feature view models and a cycle-free simulation-input leaf.
- [economy-settings-pane-refactor-spec.md](economy-settings-pane-refactor-spec.md): implemented D-093 Phase 3G extraction of the shared Economy/Settings pane family, direct price-data/Settings view models and neutral Loot history bridge.
- [simulation-monster-card-view-model-refactor-spec.md](simulation-monster-card-view-model-refactor-spec.md): implemented ownership-only split of the MonsterCard presentation model and target option builder out of the main simulation adapter.
- [metric-list-presenter-hygiene-spec.md](metric-list-presenter-hygiene-spec.md): implemented generic-presenter ownership and component-API cleanup completed before controller extraction.
- [runtime-bootstrap-controller-spec.md](runtime-bootstrap-controller-spec.md): implemented generated-runtime lifecycle, compatibility and startup PriceSet resolution extraction preserving the D-094 chunk boundary.
- [local-state-recovery-controller-spec.md](local-state-recovery-controller-spec.md): implemented browser-state health/block/persist/clear orchestration and pure Settings recovery panel boundary.
- [local-state-attention-surface-spec.md](local-state-attention-surface-spec.md): implemented always-visible local-state attention notice and direct Settings recovery focus path without migration-policy changes.
- [workspace-backup-restore-spec.md](workspace-backup-restore-spec.md): implemented complete versioned browser-local Workspace workflow with bounded export/review, typed Replace/Merge planning, logical atomic Apply/rollback, explicit session-only recovery and complete Undo.
- [hiscores-lookup-controller-spec.md](hiscores-lookup-controller-spec.md): implemented request-race-safe Hiscores lifecycle extraction and topbar panel boundary.
- [setup-file-transfer-controller-spec.md](setup-file-transfer-controller-spec.md): implemented bounded rewrite setup import/export orchestration and typed caller-owned Apply boundary.
- [setup-replacement-review-undo-spec.md](setup-replacement-review-undo-spec.md): implemented review-before-Apply and persistence-aware Undo for setup file and saved-row replacement paths.
- [active-setup-reset-spec.md](active-setup-reset-spec.md): implemented canonical active Default/current-target Custom reset with grouped Review, all-style-cache scope, protected surrounding state and persistence-aware Undo.
- [price-set-transfer-controller-spec.md](price-set-transfer-controller-spec.md): implemented PriceSet import/acceptance/export/reset transaction extraction with typed caller-owned runtime application.
- [price-set-import-discoverability-spec.md](price-set-import-discoverability-spec.md): implemented D-102 workflow with one advanced Market-owned full-PriceSet disclosure, explicit replacement/format guidance and no topbar/Settings duplicates.
- [user-facing-language-units-information-hierarchy-spec.md](user-facing-language-units-information-hierarchy-spec.md): implemented source-name-first entity labels, technical-id disclosure, semantic units/abbreviations and a concise Settings-to-Economy price hierarchy.
- [cannon-pane-extraction-spec.md](cannon-pane-extraction-spec.md): implemented first low-coupling feature-pane extraction with explicit calculated presentation and action props.
- [cannon-finite-occupancy-spec.md](cannon-finite-occupancy-spec.md): implemented D-100 finite sparse occupancy, combined/player-only/cannon-only result separation, cannonball cost routing and aligned Cannon presentation.
- [numeric-input-draft-validation-spec.md](numeric-input-draft-validation-spec.md): implemented shared draft, validation, keyboard and external-update contract for required, decimal and optional numeric fields.
- [planner-xp-target-integrity-spec.md](planner-xp-target-integrity-spec.md): implemented Planner Auto-XP, live-level reconciliation and visible effective target/start-XP semantics.
- [duel-matrix-failure-state-spec.md](duel-matrix-failure-state-spec.md): implemented explicit idle/building/ready/stale/failed Duel matrix lifecycle with visible Retry and retained, labelled previous output.
- [calculation-failure-retry-lifecycle-spec.md](calculation-failure-retry-lifecycle-spec.md): implemented shared idle/building/ready/stale/failed vocabulary, fixed visible failure/Retry and retained previous output for Dense Compare, Planner and Risk.
- [game-revision-transfer-context-spec.md](game-revision-transfer-context-spec.md): implemented typed active revision plus contextual setup/saved-setup/share external contracts with legacy unknown-context support and unchanged browser persistence versions.
- [startup-bundle-performance-spec.md](startup-bundle-performance-spec.md): measured cold/warm startup, deterministic entry-JavaScript budgets and generated-runtime bootstrap splitting.
- [dev-startup-reliability-spec.md](dev-startup-reliability-spec.md): implemented non-empty pre-React startup shell, canonical readiness states, real Vite-dev first-navigation smoke and checked agent localhost handoff.
- [application-error-boundary-spec.md](application-error-boundary-spec.md): implemented root React render/lifecycle recovery, sanitized reload controls and tab-scoped in-memory startup that leaves saved browser data untouched.
- [calculation-worker-measurement-spec.md](calculation-worker-measurement-spec.md): measured production one-shot Worker construction, full-request posting, startup/delivery, execution and response phases; D-095 retains the cancellable lifecycle.
- [calculation-worker-retention-spec.md](calculation-worker-retention-spec.md): implemented D-095 one-shot protocol/controller retention contract, quantified persistent-Worker reopen triggers and hard-cancellation-safe future target.
- [feature-test-suite-split-spec.md](feature-test-suite-split-spec.md): implemented ARCH-2026-05 split of functional Playwright, composed view-model and current/topic/historical testing owners with title and gate preservation.
- [large-module-structural-split-assessment.md](large-module-structural-split-assessment.md): D-096 evidence review that keeps Trip and game-data-generator internal splits conditional until a concrete maintenance trigger exists.
- [trip-domain-retention-spec.md](trip-domain-retention-spec.md): implemented Trip-specific D-096 retention contract, calculation invariants, future dependency direction and evidence-based split triggers.
- [game-data-generator-core-retention-spec.md](game-data-generator-core-retention-spec.md): implemented generator-specific D-096 retention contract for parser direction, path/output hygiene, deterministic artifacts and evidence-based split triggers.
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
- [hiscores-global-rate-limit-spec.md](hiscores-global-rate-limit-spec.md): D-097 disabled strict global provider-budget implementation and conditional activation/distributed-abuse specification.
- [testing.md](testing.md): current validation commands and future test strategy.
- [testing/runtime-data-deployment.md](testing/runtime-data-deployment.md): source audits, generated data, local-state health, market artifacts and deployment validation.
- [testing/domain-and-integrations.md](testing/domain-and-integrations.md): golden, performance, domain, schema and same-origin integration testing.
- [testing/ui-state-and-browser.md](testing/ui-state-and-browser.md): feature view-model, persistence, controller, pane and browser coverage.

Implemented specifications preserve their dated implementation contract and
evidence. Their activation-time phase lists, measurements and “next phase”
questions are not current backlog or living architecture facts unless
[the backlog](../project/backlog.md), [decisions](../project/decisions.md) or a
current owner above explicitly reopens them. Current runtime boundaries belong
in [architecture.md](architecture.md), current validation commands in
[testing.md](testing.md) and dated run results in
[testing evidence](../project/testing-evidence.md).

## Related evidence

- [../project/npc-attack-source-audit.md](../project/npc-attack-source-audit.md): generated Revision 274 NPC attack-handler coverage, D-081 evidence and remaining partial source cases.
- [../project/architecture-audit.md](../project/architecture-audit.md): dated 2026-07-14 production-path architecture audit and classified maintenance findings.
- [../project/security-audit.md](../project/security-audit.md): dated 2026-07-14 production-path security audit, D-099 follow-up and residual operational questions.
- [../project/code-audit.md](../project/code-audit.md): dated 2026-07-14 production-path code audit, fixed low-severity defects and focused regression evidence.
- [../project/testing-evidence.md](../project/testing-evidence.md): dated validation, release and superseded failure snapshots that no longer belong in the current command owner.
- [../../ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md): historical 2026-07-13 architecture audit and implementation snapshot.
- [../../PROJECT_REVIEW_NOTES.md](../../PROJECT_REVIEW_NOTES.md): file-by-file review findings.
- [../../SECURITY_AUDIT.md](../../SECURITY_AUDIT.md): historical legacy-focused security audit snapshot.

## Current validation commands

The repo has package scripts for the rewrite scaffold and golden fixtures. See [testing.md](testing.md) for the current commands and when to run each one.

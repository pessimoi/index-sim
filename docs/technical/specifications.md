# Technical specification catalog

- Status: implemented
- Date: 2026-07-27
- Owner: technical documentation
- Evidence: verified
- Contract: living

This catalog classifies every technical `*-spec.md` file from canonical header metadata. Current architecture and commands remain in [architecture.md](architecture.md) and [testing.md](testing.md).

Lifecycle rules:

- Active contracts authorize work through `draft`, `specced` or `active` status.
- Living contracts are implemented but still own a continuing compatibility, product/API or release boundary.
- Implemented evidence preserves a closed implementation contract and its dated rationale.
- Superseded or historical entries no longer authorize current work and must name their replacement when superseded.

## Active contracts

_No entries._

## Living contracts

- [App composition-root retention specification](app-composition-root-retention-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-14
- [Application error boundary and session-only recovery specification](application-error-boundary-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-19
- [Assistive-technology accessibility evidence specification](assistive-technology-accessibility-spec.md) — status=`implemented`; contract=`living`; owner=shared UI primitives, feature presenters and browser test owners; date=2026-07-21
- [Calculation failure and Retry lifecycle specification](calculation-failure-retry-lifecycle-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-19
- [Calculation Worker retention and persistent-trigger specification](calculation-worker-retention-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-14
- [Cross-browser release support specification](cross-browser-release-support-spec.md) — status=`implemented`; contract=`living`; owner=Playwright configuration, browser adapters and release testing; date=2026-07-21
- [Cross-tab local-state conflict safety specification](cross-tab-local-state-conflict-spec.md) — status=`implemented`; contract=`living`; owner=browser persistence boundary, local-state recovery and ready-shell feedback; date=2026-07-21
- [Local development startup reliability specification](dev-startup-reliability-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-15
- [Feature test-suite split specification](feature-test-suite-split-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-14
- [Game-data generator core retention and split-trigger specification](game-data-generator-core-retention-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-14
- [Game revision and setup-transfer context specification](game-revision-transfer-context-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-19
- [Hiscores distributed and global rate-limit specification](hiscores-global-rate-limit-spec.md) — status=`implemented`; contract=`living`; owner=server integration and deployment operations; date=2026-07-14
- [Hiscores live implementation specification](hiscores-live-implementation-spec.md) — status=`implemented`; contract=`living`; owner=technical docs; date=2026-07-14
- [Live integrations specification](live-integrations-spec.md) — status=`implemented`; contract=`living`; owner=technical docs; date=2026-07-15
- [Numeric input draft and validation specification](numeric-input-draft-validation-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-18
- [Per-item price provenance and freshness specification](per-item-price-provenance-freshness-spec.md) — status=`implemented`; contract=`living`; owner=`src/domain/shared`, `src/data/schemas`, `src/adapters/market` and; date=2026-07-12
- [Rewrite specification](rewrite-spec.md) — status=`implemented`; contract=`living`; owner=technical docs; date=2026-07-06
- [Risk and variability specification](risk-variability-spec.md) — status=`implemented`; contract=`living`; owner=technical docs; date=2026-07-11
- [Session-only exit protection and direct backup specification](session-only-exit-protection-spec.md) — status=`implemented`; contract=`living`; owner=ready-shell durability guard and existing Workspace export controller; date=2026-07-21
- [Default/custom setup mode and autosave clarity specification](setup-mode-autosave-clarity-spec.md) — status=`implemented`; contract=`living`; owner=setup shell, rewrite setup persistence and local-state feedback; date=2026-07-21
- [Shareable setup permalink specification](shareable-setup-permalink-spec.md) — status=`implemented`; contract=`living`; owner=product UI and browser adapters; date=2026-07-10
- [Startup and bundle performance specification](startup-bundle-performance-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-13
- [Trip domain retention and split-trigger specification](trip-domain-retention-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-14
- [UI Parity Specification](ui-parity-spec.md) — status=`implemented`; contract=`living`; owner=technical docs; date=2026-07-08
- [Visual regression specification](visual-regression-spec.md) — status=`implemented`; contract=`living`; owner=technical testing; date=2026-07-10
- [Workbench browser history and page-context specification](workbench-browser-history-context-spec.md) — status=`implemented`; contract=`living`; owner=pure workbench URL state, App navigation composition and document title; date=2026-07-21
- [Workspace backup and restore specification](workspace-backup-restore-spec.md) — status=`implemented`; contract=`living`; owner=technical documentation; date=2026-07-19

## Implemented evidence

- [Accessibility and keyboard navigation specification](accessibility-keyboard-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Safe active setup reset specification](active-setup-reset-spec.md) — status=`implemented`; contract=`closed`; owner=setup UI and rewrite-owned browser state; date=2026-07-19
- [App composition-root Phase 4 final shell and ownership review specification](app-composition-root-phase4-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [App composition-root refactor specification](app-composition-root-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Bounded loadout optimizer specification](bounded-loadout-optimizer-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Calculation worker startup and transfer measurement specification](calculation-worker-measurement-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Cannon finite occupancy, cost and presentation specification](cannon-finite-occupancy-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-17
- [Cannon pane extraction specification](cannon-pane-extraction-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Compare/Duel pane, view-model and calculation-controller refactor specification](compare-duel-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Conditional loot presentation specification](conditional-loot-presentation-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-12
- [Conditional quest and clue loot specification](conditional-quest-clue-loot-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Contextual item-price correction specification](contextual-item-price-correction-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-19
- [Oletusskenaarion hintadatan kattavuusspeksi](default-scenario-price-completeness-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Duel matrix failure-state specification](duel-matrix-failure-state-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-19
- [Duel-only legacy import readiness specification](duel-only-legacy-import-readiness-spec.md) — status=`implemented`; contract=`closed`; owner=legacy-migration view model, with existing App import transaction; date=2026-07-21
- [Setup comparison diff and impact explanation specification](duel-setup-diff-spec.md) — status=`implemented`; contract=`closed`; owner=technical docs; date=2026-07-11
- [Dynamic loot-table market dependency coverage specification](dynamic-loot-market-dependency-coverage-spec.md) — status=`implemented`; contract=`closed`; owner=`src/domain/trip`, `src/data/market-sync-items` and generated runtime readiness; date=2026-07-12
- [Economy destructive actions Undo specification](economy-destructive-actions-undo-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Economy and Settings pane and price-data view-model refactor specification](economy-settings-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Entity label collision disambiguation specification](entity-label-collision-disambiguation-spec.md) — status=`implemented`; contract=`closed`; owner=shared entity-label presentation and option/row view models; date=2026-07-21
- [Browser file-export outcome and feedback specification](file-export-outcome-feedback-spec.md) — status=`implemented`; contract=`closed`; owner=browser download adapter and existing file-transfer controllers; date=2026-07-21
- [Global Undo visibility and targeted Reset recovery specification](global-undo-visibility-targeted-reset-spec.md) — status=`implemented`; contract=`closed`; owner=ready app shell, global status/Undo and existing state owners; date=2026-07-20
- [High-impact dynamic-loot market allowlist expansion specification](high-impact-dynamic-loot-market-allowlist-spec.md) — status=`implemented`; contract=`closed`; owner=`src/data/market-source-mapping.ts`; date=2026-07-12
- [Hiscores Apply Undo specification](hiscores-apply-undo-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Hiscores lookup controller and topbar panel specification](hiscores-lookup-controller-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Hit distribution comparison visualization](hit-distribution-visualization-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-12
- [Lazy pane loading and failure-isolation specification](lazy-pane-loading-failure-isolation-spec.md) — status=`implemented`; contract=`closed`; owner=App composition root, Workbench shell and pane-loading boundary; date=2026-07-21
- [Legacy migration internal split specification](legacy-migration-internal-split-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Legacy migration layer refactor specification](legacy-migration-layer-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Legacy Planner parity and gap-audit specification](legacy-planner-parity-spec.md) — status=`implemented`; contract=`closed`; owner=technical testing and Planner domain; date=2026-07-10
- [Local price-history lifecycle management specification](local-price-history-lifecycle-management-spec.md) — status=`implemented`; contract=`closed`; owner=Economy price-history state, presentation and persistence lifecycle; date=2026-07-20
- [Local-state attention surface specification](local-state-attention-surface-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-18
- [Local-state recovery controller and Settings panel specification](local-state-recovery-controller-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Loot and Trip pane and view-model refactor specification](loot-trip-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Manual item price overrides specification](manual-item-price-overrides-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-12
- [MetricList presenter hygiene specification](metric-list-presenter-hygiene-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Mobiilin tulos- ja navigointisilmukan viimeistelyspeksi](mobile-result-navigation-loop-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Monster-specific changes management specification](monster-specific-changes-management-spec.md) — status=`implemented`; contract=`closed`; owner=Settings, app-shell navigation and existing monster-specific state; date=2026-07-20
- [Planner pane, view-model and calculation-controller refactor specification](planner-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Planner results-first and advanced gear-pool specification](planner-results-first-advanced-gear-pool-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Planner warning completeness and actions specification](planner-warning-completeness-actions-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Planner XP and target integrity specification](planner-xp-target-integrity-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-19
- [User-friendly price date and time presentation specification](price-date-time-presentation-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [PriceSet import discoverability and surface specification](price-set-import-discoverability-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-17
- [PriceSet transfer and acceptance controller specification](price-set-transfer-controller-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Price warning relevance and presentation specification](price-warning-relevance-presentation-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-17
- [Hiscores fallback readability specification](release-polish-hiscores-fallback-readability-spec.md) — status=`implemented`; contract=`closed`; owner=Hiscores topbar panel and Player level focus routing; date=2026-07-22
- [Mobile MonsterCard navigation loop specification](release-polish-mobile-monstercard-loop-spec.md) — status=`implemented`; contract=`closed`; owner=workbench shell, mobile navigation model and MonsterCard presenter; date=2026-07-22
- [Recommendation and optimizer Undo contract specification](release-polish-recommendation-optimizer-undo-spec.md) — status=`implemented`; contract=`closed`; owner=Trip recommendation, Loot optimizer, Loadout optimizer and global Undo; date=2026-07-22
- [Visible action feedback specification](release-polish-visible-action-feedback-spec.md) — status=`implemented`; contract=`closed`; owner=ready app shell, global status/Undo and workflow-local notice owners; date=2026-07-22
- [Wide table discoverability specification](release-polish-wide-table-discoverability-spec.md) — status=`implemented`; contract=`closed`; owner=shared table presenters and feature pane CSS; date=2026-07-22
- [Workspace backup discoverability specification](release-polish-workspace-backup-discoverability-spec.md) — status=`implemented`; contract=`closed`; owner=ready app shell, Settings Workspace panel and file-transfer copy; date=2026-07-22
- [Requirement-aware loadout optimizer specification](requirement-aware-loadout-optimizer-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-12
- [Result rate semantics specification](result-rate-semantics-spec.md) — status=`implemented`; contract=`closed`; owner=composed-result presentation view models and Compare/Duel presenters; date=2026-07-21
- [Risk pane, view-model and analysis-controller refactor specification](risk-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Runtime bootstrap controller specification](runtime-bootstrap-controller-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Saved setup Merge and rename safety specification](saved-setup-merge-rename-safety-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-20
- [Rewrite setup file-transfer controller specification](setup-file-transfer-controller-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Setup replacement review and Undo specification](setup-replacement-review-undo-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-18
- [Setup transfer complete change-review specification](setup-transfer-change-review-spec.md) — status=`implemented`; contract=`closed`; owner=pure setup-diff state, setup import review and shared-setup review; date=2026-07-21
- [Simulation and MonsterCard view-model refactor specification](simulation-monster-card-view-model-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-14
- [Source-backed casket valuation specification](source-backed-casket-valuation-spec.md) — status=`implemented`; contract=`closed`; owner=`src/domain/trip` with pinned-source contract coverage; date=2026-07-12
- [Source-backed incoming damage specification](source-backed-incoming-damage-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Source-backed requirements and NPC size specification](source-backed-requirements-npc-size-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Stats/Loadout pane and view-model refactor specification](stats-loadout-pane-refactor-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-13
- [Stats source distribution specification](stats-source-distribution-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-11
- [Transfer artifact scope and filename clarity specification](transfer-artifact-scope-filenames-spec.md) — status=`implemented`; contract=`closed`; owner=transfer presentation models and shared export-filename helper; date=2026-07-21
- [User-facing language, units and information hierarchy specification](user-facing-language-units-information-hierarchy-spec.md) — status=`implemented`; contract=`closed`; owner=technical documentation; date=2026-07-19

## Superseded or historical

_No entries._

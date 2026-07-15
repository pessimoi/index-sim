# Project memory

This section owns planning material. Keep it light and keep implementation details in technical docs.

## Files

- [roadmap.md](roadmap.md): current direction and rewrite phases.
- [backlog.md](backlog.md): bounded, implementable work items.
- [decisions.md](decisions.md): accepted decisions, recommendations and open decision boundaries.
- [bug-triage.md](bug-triage.md): known legacy behavior risks and golden-fixture handling.
- [idea-inbox.md](idea-inbox.md): ideas that are not ready for implementation.
- [planner-parity/current.md](planner-parity/current.md): generated current legacy Planner behavior audit evidence.
- [numeric-user-path-audit.md](numeric-user-path-audit.md): generated cross-path numeric consistency and large legacy-delta evidence.
- [npc-attack-source-audit.md](npc-attack-source-audit.md): generated Revision 274 NPC attack-handler coverage and the still-open calculation decision package.
- [worktree-delivery-spec.md](worktree-delivery-spec.md): review, commit grouping, validation and safe `origin/master` delivery plan for the current accumulated worktree.
- [d095-worker-measurement-commit-spec.md](d095-worker-measurement-commit-spec.md): reviewable commit manifest for packaging Worker measurement and D-095 separately from D-096 and MonsterCard planning.
- [handoff-hardening-spec.md](handoff-hardening-spec.md): fresh-clone onboarding, repository verification, source-pin maintenance and technical handoff acceptance.
- [documentation-truth-cleanup-spec.md](documentation-truth-cleanup-spec.md): bounded post-handoff removal of stale present-tense questions, evidence duplication and implemented-as-open claims without product or source changes.
- [documentation-audit.md](documentation-audit.md): 2026-07-13 repository-wide file/documentation consistency audit and remaining maintenance questions.
- [testing-evidence.md](testing-evidence.md): dated validation, release and superseded failure snapshots; current commands remain in the technical testing guide.
- [architecture-audit.md](architecture-audit.md): 2026-07-14 current production-path architecture audit, verified boundaries and classified maintenance findings.
- [security-audit.md](security-audit.md): 2026-07-14 current production-path security audit, remediated workflow finding and residual operational questions.
- [code-audit.md](code-audit.md): 2026-07-14 current production-path code audit, remediated low-severity defects and validation evidence.
- [maintainability-cleanup.md](maintainability-cleanup.md): 2026-07-14 repository-wide dead-code, CSS, test ownership and documentation-truth cleanup evidence.

## Rules

- A roadmap item describes direction, not a full task list.
- A backlog item should be small enough for a focused implementation pass.
- A decision should record context and status. Do not hide open questions in prose.
- An idea stays in the inbox until a human or maintainer promotes it to backlog or decisions.

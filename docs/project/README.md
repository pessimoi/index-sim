# Project memory

This section owns planning material. Keep it light and keep implementation details in technical docs.

## Files

- [roadmap.md](roadmap.md): current direction and rewrite phases.
- [backlog.md](backlog.md): bounded, implementable work items.
- [goals/README.md](goals/README.md): ordered, directly executable goal prompts and current execution status for the product-finishing quality gaps.
- [decisions.md](decisions.md): accepted decisions, recommendations and open decision boundaries.
- [bug-triage.md](bug-triage.md): known legacy behavior risks and golden-fixture handling.
- [idea-inbox.md](idea-inbox.md): ideas that are not ready for implementation.
- [planner-parity/current.md](planner-parity/current.md): generated current legacy Planner behavior audit evidence.
- [numeric-user-path-audit.md](numeric-user-path-audit.md): generated cross-path numeric consistency and large legacy-delta evidence.
- [npc-attack-source-audit.md](npc-attack-source-audit.md): generated Revision 274 NPC attack-handler coverage, D-081 evidence and the remaining explicitly partial source cases.
- [worktree-delivery-spec.md](worktree-delivery-spec.md): historical review, commit-grouping, validation and push evidence for the 2026-07-10/13 delivery windows.
- [d095-worker-measurement-commit-spec.md](d095-worker-measurement-commit-spec.md): completed commit manifest for the D-095 Worker measurement delivery in `7cce5e4`.
- [handoff-hardening-spec.md](handoff-hardening-spec.md): fresh-clone onboarding, repository verification, source-pin maintenance and technical handoff acceptance.
- [documentation-truth-cleanup-spec.md](documentation-truth-cleanup-spec.md): bounded post-handoff removal of stale present-tense questions, evidence duplication and implemented-as-open claims without product or source changes.
- [documentation-audit.md](documentation-audit.md): current repository-wide documentation audit window plus the preserved 2026-07-13 historical audit evidence.
- [testing-evidence.md](testing-evidence.md): dated validation, release and superseded failure snapshots; current commands remain in the technical testing guide.
- [architecture-audit.md](architecture-audit.md): dated 2026-07-14 production-path architecture audit, verified boundaries and classified maintenance findings.
- [security-audit.md](security-audit.md): dated 2026-07-14 production-path security audit, D-099 follow-up and residual operational questions.
- [code-audit.md](code-audit.md): dated 2026-07-14 production-path code audit, remediated low-severity defects and validation evidence.
- [maintainability-cleanup.md](maintainability-cleanup.md): 2026-07-14 repository-wide dead-code, CSS, test ownership and documentation-truth cleanup evidence.

## Rules

- A roadmap item describes direction, not a full task list.
- A backlog item should be small enough for a focused implementation pass.
- An executable goal owns implementation slicing, required checks and documentation transitions; its parent technical specification remains the requirement authority.
- A decision should record context and status. Do not hide open questions in prose.
- An idea stays in the inbox until a human or maintainer promotes it to backlog or decisions.

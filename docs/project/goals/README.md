# Executable product-finishing goals

- Status: completed; PF-01 through PF-06 and RP-01 through RP-06 complete
- Date: 2026-07-22
- Owner: project execution planning
- Source specifications: the
  [six product-finishing gaps](../backlog.md#next-product-finishing-specifications)
  and
  [six release-polish gaps](../backlog.md#2026-07-22-release-polish-specifications)

## Purpose

This directory converts the six accepted technical specifications into bounded
implementation goals that another Codex task or maintainer can execute without
inventing scope, architecture, validation or completion criteria.

The technical specifications remain the requirement owners. These goal files
own execution slicing, ordered work, concrete starting points, required checks
and documentation transitions. If a goal and its parent specification disagree,
the parent specification wins and the goal must be corrected before coding.

## Execution order

| Order | Goal                                                                                         | Parent specification                                                                                      | Priority | Effort | Dependency                                              |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------- |
| 1     | [PF-01 · Consistent result rate semantics](pf-01-result-rate-semantics.md)                   | [Result rate semantics](../../technical/result-rate-semantics-spec.md)                                    | Critical | M      | None                                                    |
| 2     | [PF-02 · Disambiguate colliding entity labels](pf-02-entity-label-collisions.md)             | [Entity label collision disambiguation](../../technical/entity-label-collision-disambiguation-spec.md)    | High     | M      | None; repeat affected AT evidence after implementation  |
| 3A    | [PF-03A · Setup transfer diff core and file review](pf-03a-setup-transfer-diff-core.md)      | [Setup transfer complete change review](../../technical/setup-transfer-change-review-spec.md)             | High     | M      | Existing setup replacement Review/Undo                  |
| 3B    | [PF-03B · Shared-link and saved-row change review](pf-03b-setup-transfer-review-surfaces.md) | [Setup transfer complete change review](../../technical/setup-transfer-change-review-spec.md)             | High     | M      | PF-03A                                                  |
| 4     | [PF-04 · Protect session-only work before exit](pf-04-session-only-exit-protection.md)       | [Session-only exit protection](../../technical/session-only-exit-protection-spec.md)                      | High     | M      | Existing Workspace and truthful export outcomes         |
| 5     | [PF-05 · Clarify transfer artifacts and filenames](pf-05-transfer-artifact-clarity.md)       | [Transfer artifact scope and filename clarity](../../technical/transfer-artifact-scope-filenames-spec.md) | Medium   | M      | Run after PF-03B to avoid overlapping setup-review copy |
| 6     | [PF-06 · Add workbench browser history and context](pf-06-workbench-history-context.md)      | [Workbench browser history and page context](../../technical/workbench-browser-history-context-spec.md)   | Medium   | M      | Existing lazy pane and share-fragment owners            |

Execution status: PF-01 through PF-06 are completed with their required
evidence. The final PF-06 step adds allowlisted workbench deep links,
non-recursive Back/Forward history and ready pane/target titles without changing
the Compare default, persistence or transfer schemas.

PF-01 and PF-02 are technically independent, but the table preserves product
priority. PF-03A and PF-03B are the only deliberately split specification:
PF-03A creates the exhaustive shared comparison foundation and closes the file
import path; PF-03B consumes that foundation in shared-link and saved-row paths
and closes the parent specification.

PF-04 and PF-06 do not depend on PF-03. PF-05 is sequenced after PF-03B because
both change setup transfer labels, descriptions and browser evidence.

## Standard execution contract

Every goal executor must:

1. run `git status --short` and preserve unrelated or pre-existing changes;
2. read `AGENTS.md`, root `README.md`, `docs/README.md`,
   `docs/technical/architecture.md`, `docs/technical/testing.md`, the complete
   parent specification and the goal file before editing;
3. search the current code and tests with `rg` rather than trusting filenames or
   line numbers in the goal;
4. treat runtime code and validated data as truth when a dated document differs;
5. keep the implementation inside the parent specification's scope and stop for
   a human decision instead of adding a provider, backend, database, auth,
   deployment or persistent-schema expansion;
6. add focused regression coverage before or with behavior changes;
7. run the focused checks first, then the parent specification's broader gates;
8. update living documentation in the same change only after implementation
   evidence exists;
9. run `git diff --check`; and
10. not commit, push or update visual baselines unless the human explicitly asks
    and the repository policy for that action is satisfied.

Temporary helpers, caches and generated scratch output stay inside the
repository as required by `AGENTS.md`.

## Documentation state transitions

When a single-goal specification is complete:

- change the parent specification from `specced; implementation pending` to an
  implemented date/status;
- add a concise implementation-evidence section with real files and checks;
- change the matching backlog card from `Specced` to `Done` with current
  evidence;
- update the goal file itself from `ready for execution` to `completed` and add
  the dated check results;
- keep every parent feature-inventory row `Valmis`, but update its finishing
  note only when current behavior materially changed; and
- update architecture/testing owners only when their boundaries or current
  commands actually changed.

For the split setup-transfer work:

- after PF-03A, mark the parent spec and backlog card `Partial` with PF-03B as the
  exact remaining scope; and
- only PF-03B may mark the parent spec/card `Done` after combined regression
  evidence passes.

Do not record a test as passed unless it ran. Keep VoiceOver, NVDA, branded
Safari, physical iOS and any other manual evidence `not run` unless a human
actually completed the owning procedure.

## 2026-07-22 release-polish execution map

These six RP goals are complete. They come from the 2026-07-22 release-polish
audit over existing `Valmis` workflows and are not partial feature completions,
provider work or the open manual VoiceOver/NVDA evidence gate.

| Order | Goal                                                                                         | Parent specification                                                                                              | Priority | Effort | Dependency                                     |
| ----- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------- |
| 1     | [RP-01 · Workspace backup discoverability](rp-01-workspace-backup-discoverability.md)        | [Workspace backup discoverability](../../technical/release-polish-workspace-backup-discoverability-spec.md)       | Critical | M      | Existing Workspace backup/restore              |
| 2     | [RP-02 · Visible action feedback](rp-02-visible-action-feedback.md)                          | [Visible action feedback](../../technical/release-polish-visible-action-feedback-spec.md)                         | High     | M      | Existing global status and Undo                |
| 3     | [RP-03 · Mobile MonsterCard navigation loop](rp-03-mobile-monstercard-loop.md)               | [Mobile MonsterCard navigation loop](../../technical/release-polish-mobile-monstercard-loop-spec.md)              | High     | M      | Existing mobile navigation loop                |
| 4     | [RP-04 · Recommendation and optimizer Undo](rp-04-recommendation-optimizer-undo.md)          | [Recommendation and optimizer Undo](../../technical/release-polish-recommendation-optimizer-undo-spec.md)         | High     | M      | Existing feature-local mutation owners         |
| 5     | [RP-05 · Wide table discoverability](rp-05-wide-table-discoverability.md)                    | [Wide table discoverability](../../technical/release-polish-wide-table-discoverability-spec.md)                   | High     | M      | Existing compact layout and visual suite       |
| 6     | [RP-06 · Hiscores fallback readability](rp-06-hiscores-fallback-readability.md)              | [Hiscores fallback readability](../../technical/release-polish-hiscores-fallback-readability-spec.md)             | Medium   | S      | Existing Hiscores lookup and Apply Undo        |

Execution status: RP-01 through RP-06 implementation is complete with focused
unit/typecheck evidence and the combined release-polish functional Chromium
grep passing 59/59. All 37 Darwin snapshot candidates were reviewed, one nested
Loot-mobile sticky-cell occlusion was corrected before acceptance and two final
read-only visual runs pass 26/26. The round changes no formula, data, schema,
provider or persistence boundary; the open manual VoiceOver/NVDA evidence gate
remains separate.

## Completion report contract

The final response for every executed goal must list:

- the delivered user-visible outcome;
- changed files grouped by ownership;
- focused and broad checks with pass/fail/not-run status;
- any visual/manual evidence intentionally not run;
- preserved schema, formula, provider and persistence boundaries;
- remaining open questions or the exact blocker; and
- untracked or unrelated worktree files that still matter.

The response must not claim the whole six-goal program complete when only one
goal or PF-03A has finished.

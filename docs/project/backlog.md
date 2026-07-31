# Backlog

- Status: active
- Date: 2026-07-27
- Owner: project planning
- Evidence: partial
- Contract: living

Bounded work that can be picked up without inventing a new architecture.
Completed cards and their original evidence wording live in
[backlog history](backlog-history.md).

## Status meanings

- `Specced`: implementation boundaries and acceptance evidence are defined, but source work is pending.
- `Active`: implementation or review currently owns repository work.
- `Open`: not implemented or not decided yet.
- `Blocked`: waiting for a decision, upstream answer, manual gate or external prerequisite.
- `Conditional`: no active work unless a later release or human decision explicitly requires it.
- `Ongoing`: recurring maintenance; never permanently complete.

## Next release-readiness specifications

- `Blocked` - **#4 · High · L; manual gate open:** [assistive-technology accessibility evidence](../technical/assistive-technology-accessibility-spec.md) now has an exact typed AT-01 through AT-12 manifest, coherent focused searchable-selector semantics, deterministic zero-finding axe checkpoints, repaired metric/scroll/contrast semantics and a 320 CSS-pixel / 200% text reflow check. VoiceOver/Safari and NVDA/browser rows are explicitly `not run`; the release claim remains blocked until the manual runbook is completed.

## Dev-first cleanup specifications

- `Blocked` - **High · S:** The [toolchain dependency audit remediation specification](../technical/toolchain-dependency-audit-remediation-spec.md) has reproduced local ownership paths without mutating dependencies. Current fix selection waits for explicit approval to send the private repository dependency graph and package metadata to the npm audit endpoint, or equivalent current audit evidence supplied by the owner.

- `Blocked` - **High · M; external state gate:** The [production-readiness trigger specification](../technical/production-readiness-trigger-boundary-spec.md) classifies Cloudflare state as `active-or-unknown`, preserves the binding/migration and has separated ordinary quality from account-free deployability. Config cleanup waits for owner/operator account, Worker-version, origin and namespace evidence.

- `Blocked` - **High · M; tester-data gate:** The [legacy compatibility support sunset specification](../technical/legacy-compatibility-support-sunset-spec.md) now has a complete living support matrix and compatibility freeze; focused tests pass. Reader/alias sunset waits for the known tester's current-format backup or explicit no-data acknowledgement.

- `Active` - **Medium · L; Stage 1 complete:** The [archived legacy fixture-extraction specification](../technical/archived-legacy-fixture-extraction-spec.md) now keeps executable archived sources out of default tests and normal handoff gates. Golden and Planner evidence is immutable, convenience tests use generated/static builders, and runtime readiness reads static evidence. Broad comparison-snapshot reduction remains active; root archived deletion waits for the external compatibility checkpoint.

- `Blocked` - **Medium · M; consumer gate:** The [market compatibility scaffolding retirement specification](../technical/market-compatibility-scaffolding-retirement-spec.md) proves there is no repository application/script caller and now guards that boundary. External use remains `unknown`, so the Vite-only endpoints and their compatibility code are preserved until the known tester/maintainer confirms `no-consumer` or names the supported local tool.

## Current-app stabilization

- `Conditional` - Activate D-097 enforcement or add the specification's location-scoped WAF abuse rule only if a provider quota, public deployment or adversarial-traffic evidence requires it. Activation still needs an accepted positive quota compatible with the fixed 60-second window, D-065 account/privacy evidence, singleton load/latency review and deployed rollback proof.

- `Conditional` - Split scheduled market validation and privileged push into different jobs/runners only if the threat model requires isolation stronger than immutable action pins, lockfile install, non-persistent checkout credentials, final-step token scope and the three-file diff allowlist. Preserve deterministic no-op behavior and do not introduce broad artifact retention.

- `Conditional` - Split `src/domain/trip/index.ts` only after [the implemented Trip retention and split-trigger specification](../technical/trip-domain-retention-spec.md) is reopened by a concrete defect/conflict, repeated cross-seam change burden, dependency pressure or test-isolation failure. The module has recognizable seams and a stable barrel; size and internal-only exports do not alone justify a move-only refactor. Preserve formulas, PriceSet/persistence policy, public result shapes and golden/numeric evidence if activated. Dated size and test measurements remain in the linked assessment and [testing evidence](testing-evidence.md).

- `Conditional` - Split `scripts/game-data-generator-core.ts` only after [the implemented generator retention and split-trigger specification](../technical/game-data-generator-core-retention-spec.md) is reopened by concrete reuse, change-scatter, dependency or test-isolation evidence. Raw LostCity parsing is already split and production code does not import the script core. Preserve path/output hygiene, source pinning and generated artifact bytes if activated. Dated size and test measurements remain in the linked assessment and [testing evidence](testing-evidence.md).

- `Conditional` - Fix archived legacy current-monster price sync for nested loot entries only if the archived legacy runtime is re-promoted to a supported path. The accepted rewrite market path expands nested/tagged items through `src/data/market-sync-items.ts`; the remaining legacy behavior is legacy-only/archive-only under D-044 unless a future legacy-runtime re-promotion decision changes the boundary.

## Rewrite preparation

- `Ongoing` - Refresh only the evidence for a claim materially affected by a change. [Technical testing](../technical/testing.md) owns current repository commands; [testing evidence](testing-evidence.md) owns intentionally recorded dated runs. Manual accessibility, public deployment, account/privacy, rollback and market-cron evidence gate only their corresponding claims and do not block normal development or repository handoff.

- `Conditional` - Resolve only explicitly accepted exact-legacy Trip parity questions beyond the accepted food/banking, scarce/AFK target/respawn, reserve summary, prayer restore capacity, general potion carry controls, domain-owned potion recommendation/apply flow, grouped Trip summary and Cannon sparse-linking paths. Prayer potion modeling, live data, canonical data, provider decisions and exact archived legacy `potRec` numerical parity remain outside this backlog item unless separately accepted.

- `Conditional` - Resolve only explicitly accepted remaining Special attacks parity questions after the supported melee/ranged workflow, DBA path, magic unsupported state and D-071 source-backed dragon-halberd behavior. New special formulas, magic DPS specials and adjacent-target simulation remain outside this item unless separately accepted.

- `Ongoing` - Extend mocked live integration fixtures as upstream contracts evolve. D-061 has sanitized Hiscores provider/schema/security coverage, and D-062 has sanitized item-page/estimator coverage plus separately recorded opt-in live dry-run evidence; default tests never call live upstreams. Promote repository-variable and scheduled-run evidence only through the owning operations specification.

- `Conditional` - Extend the rewrite UI to full legacy parity only if a later release explicitly raises the bar beyond the accepted selected parity slice. The current V1 replacement scope is already accepted for the visible workflows tracked in feature inventory.

- `Conditional` - Delete archived legacy runtime files only after authoritative generated-runtime replacement, the retained comparison-snapshot field manifest and the external compatibility decision are complete. Normal tests no longer execute root legacy sources, but the manual capture/bridge regeneration tools and archived UI still consume them, so deletion remains later replacement-readiness work, not a current handoff blocker.

## Documentation maintenance

- `Ongoing` - Update this backlog when an item moves into active work or becomes obsolete.

- `Ongoing` - Move larger speculative ideas to [idea-inbox.md](idea-inbox.md). Remove stale ideas from the inbox when they become accepted backlog/decision work or are already covered by completed feature inventory.

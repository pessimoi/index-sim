# Documentation governance load-reduction and phase-language specification

- Status: implemented
- Date: 2026-07-31
- Owner: documentation governance and project planning
- Evidence: verified
- Contract: living

## Purpose

Reduce documentation and acceptance ceremony in normal development while
preserving current truth owners, security boundaries, decision history and
traceable external claim gates.

The goal is not fewer documents as an end in itself. It is to prevent closed
implementation evidence, future-adopter production preparation and ambiguous
“production” language from becoming mandatory re-review work for unrelated
changes.

## Verified starting state

- The repository documentation checker validates 171 Markdown files, 144
  metadata owners and 170 reachable documents.
- `docs/` contains approximately 49,000 lines.
- The technical catalog already distinguishes active, living, implemented
  closed and historical specifications.
- No executable goal program is active before this cleanup program.
- The roadmap describes the repository as adopter-ready but says running a
  public instance is optional adopter work.
- README, architecture, operations and agent guidance still use “production
  app/path/runtime” for the supported root entrypoint even though no concrete
  public production instance is evidenced.
- Backlog keeps release evidence ongoing and a manual assistive-technology
  release claim blocked while most production activation work is conditional.
- Dated evidence has dedicated catalog/index owners, but many closed specs
  retain mutable-looking counts, hashes and “full verify” narratives.

## 2026-07-31 implementation result

- Living root, architecture, operations, product and agent guidance now
  distinguish the supported root runtime, optimized production artifact,
  accepted deployment target and an evidenced public instance.
- `AGENTS.md` limits documentation updates to changed living truth, active work
  and real backlog/roadmap status changes. Closed specs and dated evidence are
  no longer normal-change checklists.
- The backlog keeps manual accessibility, Cloudflare, market cron, deployment
  and rollback evidence scoped to their corresponding claims.
- `createSpecificationCatalogPlan()` deterministically derives every technical
  specification label, group, status, contract, owner, date and canonical row.
  `docs:check` compares the committed catalog against that plan and remains
  read-only and network-free.
- No roadmap direction, decision history, closed evidence or dated run record
  was bulk rewritten.

## Documentation classes

Every documentation change must respect these classes:

### Current truth owners

Living product, architecture, testing, operations, decisions and backlog
documents define current behavior and active boundaries. Update them when their
owned truth changes.

### Active specifications

`draft`, `specced` and `active` specifications authorize bounded future work.
They must be linked from the technical catalog and backlog while active.

### Closed implementation evidence

Implemented `closed` specifications preserve what was built and why. They do
not become a checklist for later unrelated work. After closure, update them
only to:

- repair navigation;
- correct a factual error about the historical implementation;
- add supersession metadata; or
- remove unsafe material.

New run totals, hashes, versions or current commands belong in living owners or
dated evidence, not closed specs.

### Dated/historical evidence

Evidence records prove a specific run or review. They never override current
code or living owners and do not need refresh after later changes.

## Phase-language contract

Use these terms consistently in living documents and current UI/operational
copy:

- **current app** or **supported root runtime**: the Vite/React application at
  `index.html`;
- **archived legacy runtime**: the unsupported reference application under
  `legacy/index.html` and root legacy sources;
- **production artifact**: the optimized build output, independent of whether
  it has been deployed;
- **deployment target**: the accepted optional Cloudflare shape;
- **public instance** or **production instance**: a concrete deployed origin
  with named operator and environment evidence;
- **repository handoff**: delivery of source, tests, build/runbook and current
  limitations without a live service claim; and
- **trusted-tester handoff**: the explicitly bounded external test use.

Replace “production app path” with “current/supported app path” where the text
only distinguishes root Vite from archived legacy. Retain “production” where
the statement truly concerns optimized artifact behavior, Cloudflare runtime,
security headers or a concrete deploy claim.

Do not rewrite historical quotations or dated decisions merely to apply new
terminology. Add a present-day clarification if a historical phrase would
otherwise mislead.

## Change-obligation rules

A change updates only:

1. code/data truth owners for the changed behavior;
2. the owning living documentation;
3. the active specification/goal, if implementation is active;
4. backlog/roadmap only when status or direction actually changes; and
5. dated evidence only when a new evidence claim is intentionally recorded.

It does not require:

- refreshing every closed spec that names the module;
- copying test totals/artifact hashes into living prose;
- re-running public deployment or manual accessibility gates for unrelated
  source;
- updating roadmap when phase/direction is unchanged;
- promoting conditional adopter work into active backlog; or
- recording a new decision for a behavior-preserving internal edit already
  inside an accepted boundary.

`AGENTS.md` change recipes and done criteria must reflect these rules.

## Catalog maintenance

Keep the metadata contract and reachability/link checks. Reduce manual drift by
making the technical specification catalog deterministic:

- add a read-only catalog-plan function that derives section, link label,
  status, contract, owner and date from technical `*-spec.md` metadata;
- add an npm script named `docs:catalog:write` only if deterministic write
  support is useful;
- make `docs:check` compare the committed catalog with the derived plan;
- never use current wall-clock time or network data; and
- preserve intentional introductory prose outside the generated entry blocks.

If the existing checker already owns a sufficient deterministic comparison,
implementation may keep the manual file and only add a focused writer. Do not
introduce a documentation framework or build-time runtime dependency.

## Backlog and release-claim cleanup

- Keep manual assistive-technology evidence blocked only for the corresponding
  release/accessibility claim, not normal development.
- Change “keep release evidence current after every release-impacting change”
  to impact-based wording that identifies the exact affected claim.
- Keep Cloudflare account, public smoke, rate-limit activation, market cron and
  rollback rehearsal conditional until their external triggers exist.
- List these dev-first cleanup specifications as `Specced`, but do not mark
  their implementation active without an executor.
- Do not change the roadmap's product direction merely because the gate/docs
  process is simplified.

## Documentation checker boundaries

Preserve checks for:

- canonical metadata;
- required owner/status/contract fields;
- broken local links and unreachable documents;
- catalog/header disagreement;
- generated/superseded impossible states;
- mutable dated evidence leaking into named living owners; and
- current owner navigation.

Do not add gates for:

- exact prose length;
- number of decisions/specifications;
- historical test totals staying current;
- wording equality across closed evidence; or
- public deployment evidence when no public claim is made.

## Safeguards

- Code and validated data remain first truth.
- Accepted security/privacy/data-retention decisions remain easy to find.
- Open questions stay questions; absence of evidence is not rewritten as fact.
- Dated evidence is not deleted to improve line counts.
- Closed specs keep rationale needed to understand intentional deltas.
- Current run/build/deploy commands have one living owner.
- The checker stays deterministic, read-only by default and network-free.

## Non-goals

- No bulk deletion or translation of documentation.
- No change to product scope, UI behavior or technical architecture.
- No hiding of unresolved manual, provider or deployment evidence.
- No arbitrary document/line-count target.
- No replacement of Markdown with an external documentation platform.
- No automatic decision-log rewriting.

## Implementation sequence

1. Inventory current truth owners, active specs, closed specs and evidence.
2. Apply the phase-language contract to living root/technical/operations/agent
   documents only.
3. Update change recipes and done criteria with the obligation rules.
4. Reclassify backlog release/adopter work without changing product direction.
5. Add or confirm deterministic catalog generation/comparison.
6. Remove mutable current-state requirements from closed specs only where they
   are actively misleading; preserve historical wording as evidence.
7. Run link/metadata/navigation checks and inspect the resulting diff for
   accidental history rewrites.

## Acceptance checks

```sh
npm run test -- src/tests/documentation-check.test.ts
npm run docs:check
npm run format:check
git diff --check
```

Repository searches must show that current living docs distinguish supported
runtime, production artifact and concrete public instance. Historical evidence
hits are allowed.

## Done when

- living owners use the phase-language contract;
- normal changes have a bounded documentation update obligation;
- closed specs no longer act as current checklists;
- conditional adopter/release evidence is not a normal-development blocker;
- technical catalog entries are deterministic and checker-owned;
- metadata, security decisions, links and historical evidence remain intact;
  and
- roadmap changes only if a real project-direction decision is separately
  accepted.

## Resolved boundaries

- The checker validates the manually committed catalog against a deterministic
  plan. No writer is added because validation already prevents drift without
  creating a new mutation command.
- Closed specifications remain reachable as rationale/evidence. Living owners
  point to them only for accepted contracts or history, not as recurring full
  verification checklists.

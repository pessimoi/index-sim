# Documentation truth cleanup specification

- Status: implemented
- Date: 2026-07-15
- Owner: project documentation
- Evidence: verified
- Contract: closed

- Source: post-handoff no-expansion repository review
- Related decisions: [D-032, D-042, D-047, D-048, D-049, D-061, D-062, D-067 and D-095](decisions.md)

## Purpose

Finish the repository handoff by removing stale present-tense documentation
claims that survived the implementation and audit passes.

This is a documentation-only truth-alignment goal. It must not add product
scope, change runtime behavior, refresh generated data, alter accepted numeric
baselines or turn adopter-operated deployment evidence into repository work.

## Verified trigger evidence

The 2026-07-15 no-expansion review found no open implementation blocker:

- every row in [the feature inventory](../product/feature-inventory.md) is
  `Valmis`;
- [the backlog](backlog.md) has no active `Open`, `Partial`, `Blocked` or
  implementation-pending `Specced` card before this documentation goal;
- `npm run verify` passes 80 test files / 787 tests, 19 explicit goldens,
  typecheck, the 124-source/109-client module graph, build and artifact budgets,
  lint, formatting and diff checks;
- `npm run runtime:readiness -- --example-limit 5` reports `ready` with no
  blockers; and
- `npm run numeric:audit` reports 5,958/5,958 cross-path comparisons with no
  mismatch.

Those numbers are dated activation evidence for this specification. They must
not be copied into additional living "current evidence" sections during the
implementation.

The remaining defects are documentation contradictions:

- product open questions repeat migration and Planner decisions that are
  already closed;
- the live-integration specification still describes the accepted Hiscores
  provider and market page contract as unknown;
- the decision-boundary list says final Cannon workbench placement is open
  after the Cannon pane was implemented;
- the idea inbox still proposes a Compare/Planner Web Worker after the accepted
  calculation Worker implementation;
- the parity report presents old browser/visual counts and an obsolete
  worker-not-implemented boundary as current;
- operations and backlog duplicate superseded release counts and hashes even
  though testing documentation owns current and dated evidence separately.

## Outcome

After this goal:

1. living product, technical, operations and project documents agree with the
   implemented root Vite rewrite;
2. resolved decisions are not phrased as open work;
3. dated evidence remains dated instead of competing with current test truth;
4. mutable test counts and artifact hashes have one clear owner; and
5. no new implementation or product backlog is created.

## Non-goals

Do not use this cleanup to:

- change `src/`, `scripts/`, root JavaScript/JSX, generated data, market JSON,
  fixtures, baselines, configuration or package files;
- add a documentation checker, CI job, merge gate or new npm command;
- rerun or rewrite generated audit reports merely to refresh dates;
- delete archived legacy runtime files or historical audit snapshots;
- activate the D-097 Hiscores provider budget or any WAF rule;
- connect Cloudflare, run a live Hiscores lookup, trigger the scheduled market
  writer or claim scheduled-current prices;
- decide quest state, conditional-loot activation, exact legacy `potRec`
  parity, Ring of Wealth scope, future gear, `Sell unopened`, a public result
  type rename or multi-revision simulation; or
- broaden legacy migration beyond the accepted D-042/D-048/D-049 boundary.

## Truth ownership after cleanup

Use these owners consistently:

| Truth                                                                   | Owner                                                  | Other documents may contain                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Current required validation commands and latest repository gate summary | [technical testing](../technical/testing.md)           | A link and the operational reason to run the gate                |
| Dated test runs, counts, hashes and superseded failures                 | [testing evidence](testing-evidence.md)                | Explicitly dated historical evidence only                        |
| Current runtime/module boundaries                                       | [technical architecture](../technical/architecture.md) | Short links or accepted decision summaries                       |
| Accepted choices and still-open decision boundaries                     | [decisions](decisions.md)                              | References, not duplicate open-question lists                    |
| User-visible feature completion                                         | [feature inventory](../product/feature-inventory.md)   | Product summaries that do not invent a second status             |
| Repository work status                                                  | [backlog](backlog.md)                                  | No mutable evidence snapshot when a truth owner already exists   |
| Deployment commands and adopter claim gates                             | [operations](../operations/README.md)                  | No claim that account evidence is repository implementation debt |
| Historical repository-wide audits                                       | Existing audit documents                               | Their original date/count context, clearly labelled historical   |

## Required documentation changes

### 1. Product open questions

Update [the product overview](../product/README.md):

- remove the question asking whether saved setups should survive through
  migration; the accepted rewrite setup, custom setup, Cannon and Duel
  migration boundary is implemented;
- remove the question asking whether future/hypothetical Planner gear should
  be exposed for V1; D-047 keeps it out of V1 and defines the reopen rule;
- remove the question asking whether legacy browser setup keys should be
  migrated or left legacy-only; D-042, D-048 and D-049 define the exact mixed
  import/review-only boundary;
- retain genuinely open product questions, including future changes to the
  accepted parity bar, evidence-backed bug deltas and optional public domain;
- link to decisions/backlog when a short closed-boundary reminder is useful
  instead of restating the former question.

Do not imply that every possible historical legacy key is migrated. Planner
state and full legacy price history remain review-only under D-048/D-049.

### 2. Live-integration contract

Update [the live integrations specification](../technical/live-integrations-spec.md):

- replace the inline claim that the Hiscores upstream URL and response format
  are unknown with the accepted D-061 provider contract and its implementation
  owner;
- remove the open questions asking for the authoritative market API/scrape
  contract and the exact scheduled-writer response contract; D-062 owns the
  accepted first-page item Inertia contract and replacement policy;
- replace the generic legacy market-storage question with the closed
  D-049/D-063 boundary: compatible current prices may import, generated alch
  wins, scrape metadata clears only on confirmed Clear and full history remains
  review-only/not migrated;
- keep truly environment-dependent questions such as custom domain and
  effective Cloudflare log/drain settings;
- keep upstream contract drift as a conditional replacement trigger, not as a
  claim that the current implementation lacks a source contract.

### 3. Accepted decision boundaries

Update [the decision log](decisions.md):

- remove or rewrite the stale statement that final full-workbench Cannon
  placement remains open;
- point to the implemented Cannon pane/current architecture if a retained
  summary is useful;
- do not allocate a new decision ID solely to record this documentation
  correction;
- preserve the separate open boundaries for new Cannon formulas, encounter
  modeling or legacy-runtime re-promotion.

### 4. Idea inbox

Update [the idea inbox](idea-inbox.md):

- remove `Web Worker for compare and planner calculations`; the one-shot
  Worker covers Dense Compare, Planner, Duel matrix and Risk under D-095;
- clarify `Server-side market scraper with scheduled snapshots` so it cannot
  be mistaken for the implemented scheduled repository writer. If retained,
  name it as a future server-managed or request-triggered market service beyond
  the accepted writer; otherwise remove it as superseded;
- keep account-backed saves, database-backed history, a separate publishable
  domain package and public API as unpromoted ideas.

### 5. Parity classification versus dated evidence

Update [the rewrite parity report](../technical/rewrite-parity-report.md):

- make its header/status explicit about whether it is a dated 2026-07-11 audit
  snapshot or a living parity-classification document;
- retain the 5,958-comparison calculation audit and accepted parity buckets
  with their dates;
- remove present-tense claims that 63/63 browser tests, 5/19 visuals or the
  older artifact matrix are the current repository gate;
- link current validation status to technical testing and dated run details to
  testing evidence instead of refreshing mutable counts throughout the file;
- update all claims that calculation Worker execution is absent or merely a
  future performance option. Dense Compare, Planner, Duel matrix and Risk use
  the typed one-shot Worker; persistent Worker retention remains conditional;
- preserve the zero current release-blocker classification and the distinction
  between accepted V1 scope, later enhancements, decision-needed work,
  adopter evidence and legacy-only behavior.

Do not turn later/decision-needed rows into implementation backlog while
editing the wording.

### 6. Operations evidence ownership

Update [the operations guide](../operations/README.md):

- replace `Current release evidence snapshot` with a stable release-validation
  ownership section or equivalent;
- remove duplicated mutable unit/browser counts, artifact byte totals and
  checksums from the living operations guide;
- link to technical testing for the current gate and testing evidence for dated
  results;
- retain operational follow-up: Cloudflare account connection, preview and
  production smoke, effective header/log verification, rollback evidence and
  the first configured scheduled-market run before corresponding public claims;
- keep those steps classified as adopter operations, not missing repository
  implementation.

### 7. Backlog evidence ownership and goal status

Update [the backlog](backlog.md):

- add this work as one bounded `Specced` documentation-only card while it is
  pending;
- rewrite the `Ongoing` V1 release-evidence card so it points to the testing
  owners rather than embedding the superseded 2026-07-11 counts and hash;
- do not rewrite every historical `Done` card. A dated result inside a
  completed implementation card is valid evidence when it does not claim to be
  the latest repository state;
- after implementation and validation, mark this card `Done` and summarize the
  corrected ownership boundaries without copying a new mutable test matrix.

### 8. Documentation navigation

Keep this specification linked from:

- [the root documentation map](../README.md); and
- [the project memory map](README.md).

When the cleanup is implemented, keep the specification as the review contract
and change its status to `complete`; do not replace the earlier repository-wide
documentation audit or maintainability evidence.

## Editing rules

- Preserve historical counts when the surrounding text names their date and
  does not call them current.
- Prefer removing duplicate truth over refreshing the same number in several
  files.
- Do not rewrite decision rationale merely because a later decision supersedes
  it; update only present-tense/open-boundary summaries that contradict the
  accepted log.
- Do not weaken public-live claim gates. Repository-ready is not the same as a
  verified deployed instance or a successful configured market cron.
- Treat the three mapped-but-currently-unpopulated prices
  (`dragonshield_a`, `rune_spear`, `runite_bar`) and the ten unsupported
  species-specific unidentified-herb mappings as documented non-blocking
  data/operations boundaries, not as new implementation work.
- Keep Markdown link targets repository-relative inside documents.

## Validation

Required for the documentation-only implementation:

```sh
git status --short
git diff --check
npm run format:check
```

Also inspect the final diff and verify:

- every new or changed local Markdown link resolves;
- every referenced npm command exists in `package.json`;
- changed paths are limited to Markdown documentation;
- the stale Worker idea, unknown-provider claim, unknown-market-contract
  questions and open Cannon-placement claim no longer appear as current truth;
- operations and the ongoing backlog row no longer compete with testing for
  the latest counts/hashes; and
- no historical audit snapshot, generated report, fixture, baseline or source
  file changed.

The full unit, browser, visual and numeric suites are not required for wording-
only implementation unless the final diff expands beyond Markdown. The dated
2026-07-15 `npm run verify`, runtime-readiness and numeric-audit results above
are activation evidence, not permission to skip stronger checks after a source
change.

## Completion evidence

Implemented on 2026-07-15 as a Markdown-only handoff finalization:

- resolved migration and future-gear questions were removed from the product
  open-question list without broadening the accepted D-042/D-047-D-049 scope;
- the live-integration specification now names the accepted D-061 Hiscores and
  D-062 market contracts and keeps only real provider-drift/adopter questions;
- the decision summary and idea inbox no longer present Cannon placement or
  the calculation Worker as unimplemented;
- the parity report separates its dated 2026-07-11 audit evidence from the
  current classification and recognizes the implemented D-095 one-shot Worker;
- operations and backlog delegate current commands/results to technical
  testing and dated counts/hashes to testing evidence;
- the detailed runtime/deployment testing guide no longer says the Duel matrix
  lacks a Worker or owns an obsolete full-suite count; and
- both documentation maps retain direct navigation to this completed contract.

Validation passed:

- `git diff --check`;
- `npm run format:check`;
- local target resolution across 84 Markdown files;
- every concrete documented `npm run` reference resolves to `package.json`;
- focused stale-claim searches returned no hit in the living target documents;
  and
- `git status --short` showed only the eleven Markdown files in this goal.

No source, script, package, configuration, generated artifact, market data,
fixture, baseline or historical audit snapshot changed. Full unit/browser/
visual reruns were not required by the documentation-only testing policy.

## Done when

- all eight required documentation changes are complete;
- no resolved decision is still presented as an open implementation question;
- current commands/evidence, dated evidence and operational claim gates have
  unambiguous owners;
- the backlog card and this specification are marked `Done`/`complete`;
- documentation navigation links resolve;
- validation passes; and
- the worktree contains no non-documentation change from this goal.

# Current documentation facts and drift-control specification

- Status: implemented
- Date: 2026-07-27
- Last verified: 2026-07-27
- Owner: project documentation
- Evidence: verified
- Contract: living

- Parent goal:
  [DOCS-01](../goals/docs-01-documentation-structure-hardening.md)
- Program: [documentation structure hardening](README.md)

## Purpose

Give every volatile repository fact one explicit owner and prevent dated
counts, hashes or run results from competing with current documentation.

## Problem

The living architecture document currently claims 149 source modules and 134
client-reachable modules. The repository-owned architecture check reports 178
and 164. Living architecture and testing guides also repeat artifact sizes,
hashes, test totals and dated implementation measurements that naturally drift.

## Truth ownership

| Fact                                                | Living owner                                     | Evidence owner                  |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------- |
| Runtime/module boundaries and dependency rules      | `docs/technical/architecture.md`                 | Dated architecture audits       |
| Current validation commands and change routing      | `docs/technical/testing.md` and its topic guides | Dated testing evidence          |
| Module/test/artifact counts, hashes and pass totals | No durable prose owner                           | Dated testing or audit evidence |
| Current revision and generated snapshot identity    | Committed generated snapshot/source-pin files    | Revision-impact report          |
| Current market capture identity                     | `prices.json` and `price-provenance.json`        | Operations evidence             |
| Accepted choices and unresolved boundaries          | `docs/project/decisions.md`                      | Dated rationale in the same log |

## Requirements

1. Inventory present-tense counts, hashes, timestamps and pass totals across all
   living documentation.
2. Remove current module counts and artifact measurements from architecture.
   Keep the dependency policy and point to `npm run architecture:check` for the
   current graph result.
3. Replace the testing guide's copied latest matrix with a compact dated pointer
   to the newest evidence entry. Commands and interpretation remain in the
   testing guide.
4. Keep historical values only where the date and evidence context are explicit.
5. Replace duplicated current facts in backlog, feature inventory, operations
   and topic guides with links to the owning document.
6. Record the machine-readable owner whenever a generated JSON value is the
   current truth; do not copy the value into several Markdown files.
7. Add a documentation-check rule that rejects configured volatile fact
   patterns from non-owner living documents. The allowlist must be explicit,
   repository-relative and covered by tests.

## Non-goals

- Do not change architecture rules, source imports, artifact budgets or test
  commands.
- Do not erase activation-time evidence from completed specifications.
- Do not regenerate game data, prices, screenshots or test evidence.
- Do not make `docs:check` execute expensive builds, browsers or live requests.

## Validation

- Run `npm run architecture:check` and compare its output with every remaining
  present-tense architecture claim.
- Search all living docs for module counts, artifact hashes and pass totals.
- Run the new local documentation checker, formatting and `git diff --check`.
- Confirm that historical values remain explicitly dated.

## Done when

- no living architecture text contains a stale graph count;
- every volatile fact has exactly one current or machine-readable owner;
- all other occurrences are dated evidence or links;
- checker exceptions are explicit and tested; and
- no runtime, data, test-result or generated artifact changed.

## Implementation evidence

- The dated activation baseline moved to
  [activation-audit-2026-07-27.md](activation-audit-2026-07-27.md).
- Living architecture and testing owners no longer carry mutable graph,
  artifact, hash or pass-total snapshots.
- The read-only documentation checker enforces an explicit volatile-fact file
  set, patterns and narrow durable/identifier exceptions with focused tests.
- `npm run docs:check`, architecture validation, formatting and diff checks
  passed for this work package before closeout.

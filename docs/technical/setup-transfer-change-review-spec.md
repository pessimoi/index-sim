# Setup transfer complete change-review specification

- Status: implemented
- Date: 2026-07-21
- Owner: pure setup-diff state, setup import review and shared-setup review
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: L
  presentation
- Feature-inventory parents: Basic combat setup, Setup comparison and
  shareable setup permalink (`Valmis`)
- Depends on: implemented setup replacement Review/Undo, contextual transfer
  compatibility and share Load/Dismiss/Undo contracts
- Executable goals:
  [PF-03A · Diff core and setup-file review](../project/goals/pf-03a-setup-transfer-diff-core.md),
  then
  [PF-03B · Shared-link and saved-row review](../project/goals/pf-03b-setup-transfer-review-surfaces.md)

## Purpose

Turn setup import and shared-link review into a real current-to-incoming change
review. Before Apply or Load, a user must be able to inspect every changed
user-controlled value in the transfer's actual scope, including values hidden
outside the currently active combat style or pane.

This work deepens review only. Existing parsers, external envelopes,
compatibility decisions, persistence transactions, Dismiss behavior and exact
Undo boundaries remain authoritative.

## Verified current behavior and problem

The rewrite setup file contains a complete `SavedSetupState`:

- active form and default form;
- Default/Custom mode;
- per-monster custom setups;
- per-monster cannon settings; and
- Dense Compare preferences.

Each `CombatSetupFormState` also contains player levels, all three per-style
loadout caches, prayers, boosts, special attack, manual overrides, Trip inputs
and Planner targets.

The setup-file path now implements PF-03A. Its review shows all 13 required
groups, complete semantic `Current → Incoming` changes, accurate scope,
collection status and bounded detail materialization. Applicable current-state
changes stale the candidate, Refresh compares the same parsed file again and a
synchronous fingerprint check prevents a raced Apply. No-op files cannot Apply
or create Undo.

A shared setup carries the active form plus current-monster cannon, loot row
preferences and loot settings. Its implemented review uses the same complete
form registry, then adds target-owned cannon, exact stable-row-id loot actions
and loot settings. Included-scope changes stale the in-memory comparison;
recipient PriceSet changes do not.

A saved Duel row's Load action now opens the same complete form review against
the current saved row id. Current target, cannon, loot and prices remain shared
or excluded context, and the previously implemented calculated `Review diff`
stays a separate comparison surface.

Both flows already validate before review, require an explicit action and offer
the implemented Undo after mutation. The missing part is informed consent: the
review cannot currently reveal the majority of the state it will replace.

## Feature-inventory boundary

Basic setup, setup import/export, saved setup Load and shareable setup remain
`Valmis`. This specification is one newly identified review-quality gap over
those workflows.

It extends only the review-presentation sections of:

- `setup-replacement-review-undo-spec.md`; and
- `shareable-setup-permalink-spec.md`.

Those documents retain file reading, candidate lifecycle, compatibility,
Apply/Load, persistence, Dismiss and Undo ownership. The game-revision transfer
context document retains revision compatibility wording.

## User promise

Before replacing state from a setup file or shared link, the user sees:

- what the artifact includes and excludes;
- every changed field in its actual scope as `Current → Incoming`;
- grouped added, removed and changed collection entries;
- an explicit `No changes` outcome when the transfer is equivalent; and
- a stale warning if current state changes after the comparison was prepared.

Unchanged groups may start collapsed. Changed values must never be omitted,
silently capped or represented only by a count.

## Shared change model

Create one DOM-free, allowlisted presentation contract equivalent to:

```ts
type SetupTransferKind = "setup-file" | "shared-link" | "saved-row";

interface SetupChangeValue {
  readonly display: string;
  readonly accessible: string;
}

interface SetupFieldChange {
  readonly id: string;
  readonly label: string;
  readonly current: SetupChangeValue;
  readonly incoming: SetupChangeValue;
}

interface SetupChangeGroup {
  readonly id: string;
  readonly label: string;
  readonly changeCount: number;
  readonly changes: readonly SetupFieldChange[];
  readonly children?: readonly SetupChangeGroup[];
}

interface SetupTransferChangeReview {
  readonly kind: SetupTransferKind;
  readonly currentFingerprint: string;
  readonly incomingFingerprint: string;
  readonly changeCount: number;
  readonly groups: readonly SetupChangeGroup[];
  readonly includedScope: readonly string[];
  readonly excludedScope: readonly string[];
}
```

The concrete names may differ, but the model must be closed and typed. Do not
create a generic object walker that prints schema paths, raw ids or arbitrary
values. Every compared field has an explicit formatter and group owner.

Fingerprints are opaque in-memory stale guards over canonical normalized state.
They are never shown, persisted, exported or logged.

## Canonical comparison rules

- Parse and normalize the incoming artifact through its existing strict owner
  before comparison.
- Normalize current state through the same current schema/default rules.
- Compare semantic values, not object identity, insertion order, generated
  timestamps or envelope metadata.
- Use exact entity display names and existing semantic unit formatters.
- Use `On`/`Off`, `Auto`, `None` and explicit numeric units instead of raw
  booleans, `null` or sentinel values.
- Compare arrays whose order is not semantic as normalized sets. Preserve order
  only where the current domain treats order as meaningful.
- Show a transition from missing/default to explicit state only when the
  normalized behavior changes.
- Use exact stable ids for comparison and React keys, but human-readable labels
  for presentation.

No derived DPS, XP, GP or risk calculation runs as part of review. A calculated
impact comparison remains the saved-setup Duel owner's separate workflow.

## Setup file review scope

### Top-level groups

The setup-file review must expose these groups in order:

1. Transfer context
2. Active setup identity
3. Player levels
4. Active combat loadout
5. Other combat-style loadouts
6. Prayers, boosts and special attack
7. Manual combat overrides
8. Trip, supplies and banking
9. Planner targets
10. Default setup
11. Monster-specific custom setups
12. Monster-specific cannon settings
13. Dense Compare preferences

Context is informational and does not count as a user-state change. The review
retains the existing revision/snapshot compatibility message above the diff.

### Field completeness

The explicit field registry must cover every leaf currently accepted by
`CombatSetupFormSchema`, including:

- target and combat style;
- weapon, ammo, spell, stance and all equipment slots;
- Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic levels;
- prayers, boosts, sustained mode, repot threshold and special settings;
- all manual accuracy, damage and speed overrides;
- ring of wealth;
- every Trip food, potion, prayer, teleport, alch, ammo recovery, rune,
  protection, safespot, recoil, food-count, manual supply, scarce-spot,
  target-count and respawn field;
- all five Planner targets; and
- all three per-style loadout caches.

Add an exhaustive schema-drift test: introducing a new form leaf must fail
until it is explicitly classified as shown, intentionally normalized with
another field or excluded with a documented reason.

### Collection changes

For custom setups and cannon settings:

- classify each current-game-data monster as Added, Removed, Changed or
  Unchanged by exact monster id;
- show source-backed monster names and status counts;
- allow Changed entries to disclose their complete nested field diff;
- allow Added/Removed entries to disclose the complete incoming/current
  semantic summary; and
- keep Unchanged entries initially collapsed and out of the headline change
  count.

Do not silently show only the first N entries. To keep the DOM bounded, render
the collection index first and materialize at most the currently expanded
entry's leaf rows. The underlying review remains complete.

Dense Compare shows sort field/direction plus every added/removed hidden or
irrelevant monster, not only a count.

## Shared-link review scope

The shared review compares exactly what the share envelope can apply:

1. Active setup identity
2. Player levels
3. Active combat loadout
4. Other combat-style loadouts
5. Prayers, boosts and special attack
6. Manual combat overrides
7. Trip, supplies and banking
8. Planner targets
9. Current-monster cannon
10. Current-monster loot actions
11. Current-monster loot settings

The excluded-scope disclosure must state that the link does not carry the
recipient's PriceSet, price/history data, saved setup collection, other-monster
custom/cannon/loot state, Planner UI controls, Hiscores player or calculated
results.

Loot row changes use stable row ids for comparison and current disambiguated
row labels for display. Rows dropped by compatibility normalization remain in
the existing warning and are not presented as applicable incoming changes.

The review's old `Player levels included`, cannon and loot-count chips may
remain as a compact summary only if the complete groups are directly adjacent
and keyboard reachable.

## Saved in-app setup Load

The implemented setup replacement owner also applies a saved Duel row. Reuse
the same complete `CombatSetupFormState` field registry for its Load review so
future fixes do not create a third definition of setup fields.

The saved-row review remains limited to the form actually stored in the saved
snapshot. Current target context, cannon, loot policy and prices retain their
existing shared-context behavior and must appear in excluded/unchanged-context
copy rather than as incoming changes.

If implementation slicing is required, file import and shared link are the
release gate. Saved-row reuse can land in the same change or immediately after,
but the shared registry and its exhaustiveness test are required in the first
slice.

## Candidate and stale lifecycle

### Prepare

1. Existing parser/compatibility owners produce a validated incoming candidate.
2. Capture the normalized current state for exactly that transfer scope.
3. Build the complete change review and its opaque current fingerprint.
4. Store candidate plus review only in memory.
5. Perform no mutation or persistence.

### Current-state change

Any applicable live-state change after preparation makes the review stale. The
visible surface must:

- retain the incoming candidate;
- say `Current setup changed after this review was prepared.`;
- disable Apply/Load;
- offer `Refresh comparison`; and
- keep `Dismiss` available.

Refresh compares the same validated incoming candidate with the latest current
state. It does not reread a file, parse a URL again or mutate state.

Changes outside the transfer's included scope do not make the review stale.
For example, a PriceSet change does not stale a setup-file or shared-link diff,
because neither transfer applies prices.

### Apply, Load and no-op

- Apply/Load rechecks the current fingerprint synchronously before consuming
  the candidate.
- A mismatch blocks mutation and transitions to stale even if React has not yet
  rendered the stale state.
- `No changes` disables the mutating primary action and offers Dismiss. Do not
  create a success or Undo for a no-op.
- A changed candidate delegates to the existing workflow's complete
  persistence-aware transaction and Undo.
- Existing latest-request-wins behavior remains for new file reads and share
  captures.

## Presentation and interaction

- Keep the review in the current shell-level conditional surfaces so it
  survives pane navigation.
- Start with a summary: artifact kind, context, total changed fields and the
  included/excluded scope.
- Changed groups start open; unchanged groups start closed with `No changes`.
- Nested custom/cannon entries start closed unless only one changed entry exists.
- Use semantic `<details>`/`<summary>` or equivalent button/disclosure
  semantics with visible change counts.
- Keep the primary action and Dismiss reachable without scrolling through every
  detail, while ensuring review content precedes the action in reading order.
- Return focus to the originating file input or Share control after Dismiss;
  retain existing post-Apply focus behavior.
- Do not use color alone for Added, Removed, Changed, warning or stale status.
- At mobile widths, values may stack as labelled `Current` and `Incoming`; do
  not compress them into an overflowing table.

## Privacy and security constraints

- Never render raw JSON, schema paths, localStorage keys, source paths, import
  filenames, encoded share payloads or arbitrary parser errors.
- Do not expose opaque fingerprints in the DOM or diagnostics.
- Do not retain a dismissed candidate or diff.
- Shared review does not gain prices, player names or saved collections merely
  to make the review more complete.
- Entity values must come from validated current game data or fixed sanitized
  presentation fallbacks.

## Architecture and ownership

- A new pure state/view-model owner holds the explicit field registry,
  normalization comparison and grouped presentation records.
- Existing active-setup-reset and saved-setup diff helpers should be reused or
  generalized where their semantic formatters match. Do not duplicate canonical
  defaults or create competing setup schemas.
- Setup file-transfer and share state owners retain candidate sequencing and
  compatibility authority.
- `App` remains the sole multi-family mutation/persistence/Undo composition
  owner.
- Conditional review components receive prepared data and intent callbacks;
  they do not read storage, decode payloads or calculate fingerprints.
- Domain simulation, generated data and PriceSet owners remain unchanged.

## Required tests

### Pure diff tests

- One fixture changes every `CombatSetupFormSchema` leaf and proves each field
  appears exactly once in the correct group.
- Equivalent normalized values produce `No changes`.
- Set-like ordering and default normalization do not create false changes.
- Per-style inactive loadout, Trip and Planner target changes are visible.
- Custom setup, cannon, loot row and Dense collection changes classify Added,
  Removed, Changed and Unchanged correctly.
- A schema-drift exhaustiveness test fails for an unclassified new leaf.
- No output contains raw storage keys, schema paths or opaque fingerprints.

### Controller and transaction tests

- Prepare does not mutate live state or storage.
- Included-scope mutation makes review stale; excluded-scope mutation does not.
- Synchronous Apply freshness check blocks a race before mutation.
- Refresh comparison retains the same incoming candidate and updates only the
  current baseline/diff.
- No-op Apply/Load is unavailable and creates no Undo.
- Changed Apply/Load still delegates to the existing complete persistence and
  Undo paths.
- A newer file attempt invalidates an older review as it does today.

### Browser tests

- Import a fixture changing active/inactive loadouts, levels, Trip, Planner,
  custom setups, cannon and Dense preferences; inspect every group, Apply and
  Undo.
- Open a share link changing levels, Trip, cannon, loot actions and loot
  settings; inspect current-to-incoming values, Load and Undo.
- Change applicable current state while each review is open, verify stale
  blocking, Refresh and corrected comparison.
- Verify a PriceSet-only change does not stale either review.
- Exercise keyboard disclosure/action order, focus return, 390 px mobile and
  compact landscape containment.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused setup-diff/import/share/replacement suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "reviews every setup transfer change"
git diff --check
```

Run affected read-only visual cases because the conditional review surfaces
gain nested disclosures. Any baseline update follows the existing visual review
policy.

## Acceptance criteria

- File import and shared-link review show every changed field in their actual
  apply scope.
- Unchanged fields may be collapsed but no changed value is capped or omitted.
- Included and excluded scopes are explicit and accurate for each artifact.
- Review becomes stale only when applicable current state changes, and a
  synchronous check prevents stale Apply/Load.
- No-op transfers do not mutate, persist or create Undo.
- Existing schemas, parsers, revision compatibility, persistence, Dismiss and
  complete Undo contracts remain unchanged.
- The field registry is schema-drift guarded and shared with saved-row review.
- Focused unit, controller, browser, architecture and diff checks pass.

## Partial implementation evidence · PF-03A · 2026-07-21

PF-03A completes the setup-file slice without changing any envelope, parser,
compatibility rule, persistence schema or existing Apply/Dismiss/Undo boundary.

- `src/app/state/setup-transfer-changes.ts` provides the typed DOM-free review,
  explicit formatter/classification registries, canonical setup-scope
  fingerprints and exact 13-group setup-file assembly. Its schema-drift guard
  covers every parsed `CombatSetupFormSchema` leaf and explicitly normalizes the
  active top-level loadout mirrors to their per-style cache.
- `src/app/controllers/setup-file-transfer.ts` retains validated-candidate and
  latest-request ownership while adding stale detection, same-candidate Refresh,
  synchronous consume freshness and no-op blocking. `App` remains the only
  six-family persistence and Undo composition owner.
- The conditional setup review renders included/excluded scope, total changes,
  changed-open/unchanged-closed groups and source-backed semantic values.
  Custom/cannon collection indexes remain complete while at most one entry's
  leaf rows exist in the DOM. Mobile stacks labelled Current and Incoming
  values, and actions remain after the review content in reading order.
- Focused setup transfer/replacement coverage passes 45/45. The named Chromium
  path passes 1/1 across complete disclosure, excluded PriceSet versus included
  setup staleness, Refresh, no-op, Apply/Undo, keyboard actions, 390 px and
  compact landscape containment. The clean cumulative gate passes 115 Vitest
  files / 1,102 tests, 19 goldens, typecheck, lint, formatting, the
  174-module/160-client-reachable architecture check, build and artifact
  validation.

## Full implementation evidence · PF-03B · 2026-07-21

PF-03B completes the parent specification without changing transfer or
persistence formats.

- The pure owner now exposes shared-link and saved-row builders over PF-03A's
  exact same `formGroups` field registry. Shared review adds only the incoming
  target's cannon, loot-action and loot-settings groups; repeated Loot rows use
  exact preference ids and current source-backed collision labels.
- Shared stale state is limited to form/cannon/loot/settings. Refresh retains
  the decoded and compatibility-reviewed candidate, synchronous Load rechecks
  the included fingerprint and PriceSet-only changes remain non-stale.
  Compatibility-dropped loot rows remain warning-only. Dismiss clears the
  candidate and returns focus to Share.
- Saved-row Load binds its baseline to the live form and incoming fingerprint
  to the same current snapshot id. Refresh re-resolves that id, a raced Load is
  rejected, no-op is disabled and Dismiss returns focus to the row Load control.
  The separate calculated Duel impact remains unchanged.
- Changed shared and saved-row actions delegate to the existing complete
  transactions and one-step Undo. No setup/share/Duel schema, envelope,
  compatibility, persistence, calculation or fragment-capture contract changed.
- Focused PF-03B coverage passes 53/53, the retained shared-link browser suite
  passes 3/3 and the combined one-worker Chromium transaction passes 1/1 over
  file/share/saved disclosure, stale/Refresh, PriceSet exclusion, no-op,
  Apply/Load/Undo, keyboard focus and both required compact viewports.
  Typecheck, lint, 19/19 goldens and the 174-module/160-client-reachable
  zero-cycle architecture gate pass. Repository-wide verification evidence is
  preserved in the project testing-evidence log.
- No conditional setup-review visual baseline exists in the current visual
  owner and no baseline was written.

## Open questions

None. The implementation may choose the exact disclosure component structure,
but scope completeness, stale behavior and transaction boundaries are fixed by
this specification.

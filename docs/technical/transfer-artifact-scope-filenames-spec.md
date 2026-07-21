# Transfer artifact scope and filename clarity specification

- Status: implemented 2026-07-21
- Priority: medium
- Estimated effort: M
- Owner: transfer presentation models and shared export-filename helper
- Feature-inventory parents: Basic combat setup, Setup comparison, Market price
  sync, Workspace backup/restore and Local state recovery (`Valmis`)
- Depends on: existing transfer schemas, review transactions and typed browser
  download outcomes
- Executable goal:
  [PF-05 · Clarify transfer artifacts and filenames](../project/goals/pf-05-transfer-artifact-clarity.md)

## Purpose

Make each JSON transfer action say exactly what kind of artifact it handles,
what it includes and what it excludes. Give every newly exported file a
contextual, sortable filename so setup files, saved-setup collections, PriceSets,
Workspace backups and metadata-only recovery reports are not easily confused.

This is presentation and filename work. File contents, envelope kinds,
versions, import compatibility, persistence and Undo remain unchanged.

## Pre-implementation evidence and resolved problem

The app has several intentionally different JSON artifacts:

- one rewrite combat setup file;
- the saved Duel setup collection;
- one active PriceSet;
- a full required-area Workspace backup with a sensitive player-name opt-in;
  and
- a metadata-only local-state recovery report.

Before PF-05, top-level setup actions were labelled only `Import setup` and `Export
setup`. The saved-setup collection uses `Import setups` and `Export setups`.
The difference between a current combat setup, the saved collection and a
complete Workspace backup is therefore easy to miss.

Setup and saved-collection exports use fixed filenames:

- `index-sim-rewrite-setup.json`; and
- `index-sim-saved-setups.json`.

PriceSet includes an id but no time or game revision. Workspace and recovery
files include unsimplified timestamp-like segments but use a different naming
shape. Repeated exports can be difficult to order and artifact scope is not
obvious from every filename.

Typed download feedback now reports the actual filename truthfully. Improving
filename construction and adjacent scope copy can therefore be done without a
new notification system.

## Implemented behavior

`src/app/transfer-artifact-file-name.ts` now owns the pure closed five-artifact
filename union, ASCII segment normalization, fixed fallbacks, compact UTC time
and the 48-character segment / 160-character complete-name limits. Combat
setup, saved collection, PriceSet, Workspace and recovery controllers each
capture one instant, pass the generated name to the typed browser adapter and
publish that same actual name through the existing truthful outcome.

The header, saved-setup manager, Advanced PriceSet tools, Workspace panel and
local-state recovery panel render the canonical actions below and connect their
scope copy with `aria-describedby`. File contents, envelope kinds/versions,
byte caps, parser selection, persistence transactions and Undo owners did not
change. The production-preview journey imports valid setup and saved-collection
artifacts under the former fixed filenames, proving that compatibility remains
content/schema based rather than filename based.

Validation passes 10 focused files / 90 tests, the named Chromium journey 1/1,
the retained three-engine release manifest 36/36 and the complete repository
gate 117 files / 1,123 tests plus 19 goldens. The dated artifact hash and
environment exclusions are recorded in the testing evidence log.

## Feature-inventory boundary

All parent workflows remain `Valmis`. This card clarifies boundaries among
existing artifacts; it does not expand any artifact to become another.

In particular:

- a combat setup export does not become a Workspace backup;
- saved setup collection export does not acquire active setup, cannon or loot;
- PriceSet export does not acquire manual price overlays or history;
- recovery report remains metadata-only; and
- Workspace retains its required-area and sensitive-opt-in policy.

## Canonical artifact inventory

Use these exact product concepts in visible labels and help text:

| Artifact               | Primary export action                  | Import/review action            | Included scope                                                                                                                           | Important exclusions                                                                                                                               |
| ---------------------- | -------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combat setup           | `Export combat setup`                  | `Review combat setup file`      | Active/default setup, setup mode, monster custom setups, per-monster cannon and Dense preferences in the current setup-transfer envelope | Loot preferences/settings, saved setup collection, active PriceSet, manual prices/history, full Planner UI, Hiscores player and calculated results |
| Saved setup collection | `Export saved setup collection`        | `Review saved setup collection` | Saved Duel snapshots only, including the form stored in each row                                                                         | Active setup, current target context, cannon, loot, prices/history and calculated comparison output                                                |
| PriceSet               | `Export active PriceSet`               | `Review PriceSet file`          | Current validated PriceSet item prices, metadata, provenance and compatible `alchValues` field                                           | Authority to override recipient generated high alch, manual item-price overlay, local/shared history, setup and Workspace state                    |
| Workspace backup       | `Download full Workspace backup`       | `Review Workspace backup file`  | All nine required Workspace areas from one coherent live capture; last Hiscores player only with explicit opt-in                         | Calculated outputs, pending reviews, Undo closures, pane/disclosure state and external account/server data                                         |
| Recovery report        | `Export metadata-only recovery report` | No import action                | Existing sanitized key/status/version/reason metadata                                                                                    | Raw stored payloads, live setup/player/price values and a restorable backup                                                                        |

“Full Workspace backup” means the complete required-area registry, not every
ephemeral React value. Its adjacent copy must continue to explain the optional
last Hiscores player name.

If the concrete current setup envelope is later revised, update this table and
the action copy in the same reviewed change. Do not infer scope from button
position or filename.

## Required transfer presentation

### Header combat setup

Replace ambiguous actions with:

- `Review combat setup file`
- `Export combat setup`
- existing `Share setup`

Attach concise persistent help or accessible descriptions:

```text
Combat setup files replace setup, custom-monster, cannon and Dense preferences.
They are not full Workspace backups and do not include loot or prices.
```

The complete current-to-incoming detail remains owned by the setup-transfer
change-review specification. This scope sentence appears before file selection
and is repeated in the prepared review.

### Saved setup collection

Under `Manage saved setups`, use:

- `Review saved setup collection`
- `Export saved setup collection`

Show:

```text
This file contains the saved comparison collection only. It does not replace
the active setup until you later load an individual saved row.
```

The existing merge/rename review remains the transaction owner.

### PriceSet

Keep the current Advanced PriceSet disclosure and complete-replacement guidance.
Use `Review PriceSet file` and `Export active PriceSet` consistently in button,
input accessible name and feedback copy.

Repeat that manual item prices and price history are separate browser-local
state and that generated high alch remains authoritative.

### Workspace

Use `Download full Workspace backup` and `Review Workspace backup file`.
Adjacent copy must name the high-level included families: setup, Planner, Loot,
saved setups, prices and local history. Keep the existing exact nine-area count,
revision context, size bound and player-name privacy control.

### Recovery report

Rename the action to `Export metadata-only recovery report` and state:

```text
This report helps diagnose local-state health. It contains no raw saved values
and cannot restore the Workspace.
```

Do not place it where it can be mistaken for the Workspace backup action.

## Shared filename contract

### Shape

New exports use one pure helper and this shape:

```text
2004scape-<artifact>[-<context>][-rev-<revision>]-<UTC timestamp>.json
```

The timestamp format is compact sortable UTC:

```text
YYYYMMDDTHHmmssZ
```

Examples:

```text
2004scape-combat-setup-hill-giant-rev-274-20260721T143205Z.json
2004scape-saved-setup-collection-rev-274-20260721T143205Z.json
2004scape-price-set-scheduled-rev-274-20260721T143205Z.json
2004scape-workspace-backup-rev-274-20260721T143205Z.json
2004scape-local-state-recovery-report-20260721T143205Z.json
```

Use these artifact slugs:

- `combat-setup`
- `saved-setup-collection`
- `price-set`
- `workspace-backup`
- `local-state-recovery-report`

### Context

- Combat setup context is the validated source-backed target monster display
  name.
- PriceSet context is its validated id, falling back to `active` when empty
  after sanitization.
- Saved collection and Workspace do not add a target; their contents span
  multiple entities.
- Recovery report has no game revision unless the report contract already owns
  one. Do not invent revision context in the filename alone.
- Use `rev-unknown` only when an artifact already supports unknown revision
  context. Current exports with validated active game data use the numeric
  revision.

### Sanitization and bounds

The filename helper must:

- lowercase user-facing context;
- normalize whitespace to `-`;
- keep ASCII `a-z`, `0-9` and single interior hyphens only in variable
  segments;
- trim leading/trailing separators;
- fall back to the artifact-specific fixed word when the result is empty;
- cap a variable context segment at 48 characters;
- cap the complete filename at 160 characters including `.json`;
- never include `/`, `\\`, control characters, leading dot, repeated dots,
  encoded separators or raw source paths; and
- return a non-empty deterministic filename for all validated inputs.

Unicode names may lose unsupported characters in filenames; the UI and file
contents retain the real source-backed name. Do not introduce transliteration
as an unreviewed identity rule.

The helper accepts an explicit `Date` or timestamp string so tests and envelope
construction use the same instant. Generate `savedAt`/`exportedAt` and the
filename timestamp from one captured `now`, not separate clock reads.

## Compatibility and import behavior

- Import remains content/schema based. Never select a parser, compatibility
  path or Apply policy from the filename.
- Existing fixed filenames and user-renamed files remain fully importable.
- Do not reject a valid artifact because its name is missing, unexpected,
  duplicated or lacks the new timestamp.
- Do not render an imported local filename as trusted content in review or
  error messages.
- External envelope kinds, versions, byte limits and duplicate-key guards are
  unchanged.

## Download outcome integration

Every export passes the generated filename into the existing typed download
adapter and workflow notice. Success copy remains:

`<Artifact> download started: <filename>. Check your browser downloads.`

Do not say that a file was saved. A filename-construction failure is normalized
to the existing `<Artifact> download could not be started. Try again.` outcome.

Changing the filename must not clear import reviews, reset confirmations or
other workflow state.

## Architecture and ownership

- Add one pure shared filename helper under app/controller or browser-adapter
  ownership. It receives only validated artifact kind/context/revision/time.
- Artifact builders remain the source of envelope contents and capture one
  `now` for both envelope and filename.
- Transfer view models own exact action labels and included/excluded copy.
- Existing file-transfer controllers retain parsing, review sequencing,
  persistence and notices.
- Components render prepared labels/descriptions and keep current file-input
  reset/focus behavior.
- Do not move product-specific scope knowledge into the generic download
  adapter.

## Accessibility and responsive behavior

- File inputs have the complete artifact action as their accessible name.
- Help text is connected with `aria-describedby` when it explains the adjacent
  import/export action.
- The difference between combat setup, collection, Workspace and report is
  present in text, not only filename or icon.
- Long filenames wrap as text in notices and never create horizontal page
  overflow.
- Mobile action labels may wrap but must not contract back to ambiguous
  `Import setup(s)` or `Export setup(s)`.
- Existing focus return after file selection, Dismiss and download remains.

## Security and privacy constraints

- Do not put player levels, player name, gear ids, prices, local paths, raw
  imported filenames or storage keys into generated filenames.
- Target and PriceSet context comes only from validated current state and is
  sanitized by the bounded helper.
- Do not expose the optional Hiscores player name in a Workspace filename.
- Scope descriptions must not promise inclusion of sensitive state when its
  opt-in is off.

## Required tests

### Pure filename tests

- Freeze time and prove every example shape, artifact slug, context and revision.
- Cover empty, long, whitespace-heavy, punctuation, slash, backslash, dot,
  control-character and Unicode-only context.
- Prove the 48-character segment and 160-character total bounds.
- Prove envelope timestamp and filename timestamp derive from the same `now`.
- Prove no generated filename contains a path separator or leading dot.

### Presentation and controller tests

- Every action has the exact canonical label and correct scope description.
- Combat setup, saved collection, PriceSet, Workspace and recovery export pass
  the generated filename to the existing adapter and notice.
- Old filenames and arbitrary renamed valid files still parse by content.
- Recovery report copy says metadata-only and not restorable.
- Workspace copy retains the player-name opt-in caveat.
- Filename generation or download failure produces the existing fixed failure
  outcome without disturbing review state.

### Browser tests

- Trigger all five exports with frozen time and inspect browser download
  suggestions/events for the contextual names.
- Verify setup versus saved-collection versus Workspace action/scope text.
- Import a valid old fixed-name setup and saved collection and complete their
  existing reviews.
- Check screen-reader names/descriptions and long-filename wrapping on desktop,
  compact landscape and 390 px mobile.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused filename/file-transfer/view-model suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "names and explains transfer artifacts"
git diff --check
```

Run supported-browser download-event coverage. No schema or golden calculation
change is expected.

## Acceptance criteria

- Users can distinguish combat setup, saved setup collection, PriceSet,
  Workspace backup and metadata-only recovery report before acting.
- Every action accurately names included and important excluded scope.
- All new exports use the common bounded, contextual and sortable filename
  contract and notices report that exact name.
- Existing and user-renamed imports remain content-based and compatible.
- No artifact envelope, parser, byte limit, persistence or Undo contract changes.
- No sensitive or untrusted value enters a filename.
- Focused unit, browser, supported-browser, architecture and diff checks pass.

## Open questions

None. The artifact boundaries already exist in code; this specification makes
them explicit without changing their scope.

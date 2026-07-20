# Game revision and setup-transfer context specification

Status: implemented on 2026-07-19. Generated revision context,
source-pin/readiness agreement, ready-shell/Settings presentation and
contextual setup, saved-setup and share transfers are complete. Queue-wide
full verify and visual reconciliation remain assigned to the final integration
goal rather than this feature contract.

## Purpose

Make the content basis of every calculation visible and carry that basis with
setup transfer artifacts. The ready app must identify its accepted game
revision, while imported setup files, saved-setup collections and shared links
must say whether they were created from the same generated snapshot, another
snapshot of the same revision, a different revision or an older context-free
format.

This is provenance and review context, not historical simulation. The runtime
still loads exactly one reviewed current generated snapshot.

## Prior verified behavior and problem

- Product and architecture documentation identify the root runtime as
  Revision 274, accepted under D-018 and updated only through the reviewed
  development workflow in D-035 through D-037.
- Before the first implementation slice, `src/data/generated/game-data.json`
  had stable snapshot id `lostcity-376072662e78-runtime`, a label and root
  provenance containing the source commit and generated timestamp, but no
  typed game-revision field.
- Before that slice, `src/data/generated/source-pin.json` contained source
  commit and generation metadata but omitted `source.revision` even though the
  pinned checkout was the accepted `274` branch.
- Before that slice, the app header and Settings UI did not show the active
  game revision or snapshot identity.
- Shareable setup v1 carries `gameDataId` and warns on id mismatch.
- Full rewrite setup JSON reuses the version-3 local persistence envelope and
  carries no game-data context.
- Saved Duel setup collection JSON reuses a version-1-shaped transfer envelope
  and carries no game-data context.
- Import validation correctly rejects unavailable entity ids, but a compatible
  artifact from another revision can be accepted without telling the user that
  combat, loot, requirements or results may differ.

## Feature-inventory and decision boundary

Basic setup transfer, setup comparison, setup sharing and source-backed game
data remain existing `Valmis` workflows. This goal adds truthful provenance to
them and separates external file versions from browser persistence versions.

D-035 remains authoritative: the app tracks the latest _accepted_ revision,
not whatever upstream currently exposes. Do not browse, fetch or infer a newer
revision at runtime.

## Goals

- Add typed revision/source context to the generated runtime snapshot and
  require it for the production source-backed bootstrap.
- Show `Revision 274` in the always-visible ready shell and expose detailed
  sanitized snapshot/source metadata in Settings.
- Define one shared bounded transfer context stamp.
- Give full setup files and saved-setup collection files dedicated external
  envelopes independent from localStorage versions.
- Upgrade new share links to carry both revision and snapshot id while
  continuing to read v1 links.
- Compare transfer context before Apply/Merge and show a precise review status.
- Keep entity compatibility validation authoritative regardless of context
  match.

## Non-goals

- Do not load, bundle, download, select or simulate historical revisions.
- Do not add a revision switcher, generated snapshot archive, database or
  remote content request.
- Do not automatically upgrade the accepted revision from an upstream branch,
  tag or API.
- Do not claim bit-for-bit result reproducibility from game-data context alone.
  PriceSet, manual prices and app code can also affect results.
- Do not embed a PriceSet, price history, raw source body, absolute source path
  or calculation output in setup transfer metadata.
- Do not weaken unknown-entity rejection merely because revision numbers match.
- Do not reject a fully compatible older/different-revision setup solely due to
  context mismatch; require explicit informed confirmation instead.
- Do not increment rewrite setup or Duel browser-storage versions for a file-
  format change.
- Do not parse a revision or commit back out of `GameDataSnapshot.id`, label or
  free-form provenance strings.

## Generated revision context

Add a typed optional-at-schema-boundary context to `GameDataSnapshot`:

```ts
export interface GameDataRevisionContext {
  gameRevision: number;
  sourceName: string;
  sourceCommit?: string;
  generatedAt: string;
}

export interface GameDataSnapshot {
  id: EntityId;
  label: string;
  revisionContext?: GameDataRevisionContext;
  // existing simulator-consumed data
}
```

The field is optional in the generic shared schema only so retained legacy-
derived/reference snapshots and narrow test fixtures can continue to validate
without falsely claiming a revision. It is required by the source-backed raw
generator output, generated-runtime readiness report and root production
bootstrap. A ready production root with missing/invalid revision context is a
runtime-data blocker, not `Revision unknown` success.

Schema constraints:

- `gameRevision`: positive integer, bounded to 1–9,999;
- `sourceName`: trimmed 1–120 characters;
- `sourceCommit`: optional 7–64 lowercase hexadecimal characters;
- `generatedAt`: valid ISO-8601 timestamp, maximum 64 characters; and
- strict object: no raw source path, command, branch credentials or extra
  arbitrary metadata.

`GameDataSnapshot.provenance` remains entity/root confidence detail. Do not
remove it or make UI parse it to rebuild structured revision context.

## Generator and source-pin contract

The accepted game revision must be an explicit generator input, not inferred
from incidental Git branch state. Add a bounded `--game-revision <integer>`
option and record it in the reproducible generator command.

For the current reviewed production generation:

```text
--game-revision 274
```

Raw source-backed generation must fail before writing when the option is
missing or invalid. Foundation/slice test helpers may inject a test revision or
omit context only when explicitly testing legacy/reference compatibility.

The generator writes the same values to:

- `game-data.json.revisionContext`;
- `source-pin.json.source.revision` as canonical string `"274"`;
- `source-pin.json.source.commit` when available; and
- the revision-impact report source summary.

Add a generator/readiness invariant that snapshot revision, source-pin
revision, source name, commit and generated timestamp agree. A mismatch is a
generation error. The snapshot id remains a unique generated artifact identity
and may continue to include the source commit; it is not replaced by the human
game revision.

A future accepted revision bump must change the explicit generator input,
source pin, snapshot context and impact report in one reviewed change. D-035's
calculation-impact and generated-data validation gates remain required.

## Runtime presentation model

Create a pure model from the validated snapshot:

```ts
interface GameRevisionViewModel {
  revisionLabel: string; // "Revision 274"
  snapshotLabel: string;
  snapshotId: string;
  sourceLabel: string; // "LostCityRS/Content"
  sourceCommit: string | null;
  sourceCommitShort: string | null;
  generatedAt: string;
}
```

Do not truncate the stored value. The short commit is presentation only; expose
the full validated commit as a title/details value when a short prefix is
shown.

### Ready shell

- Render one compact `Revision 274` badge beside or immediately below the app
  name in `AppHeader`.
- The badge is text, not an icon or color-only indicator.
- Its accessible name is `Active game data: Revision 274`.
- It is informational and not a live region; ordinary calculations do not
  re-announce it.
- Do not show source commit or generated timestamp in the constrained topbar.

### Settings detail

Add a `Calculation context` section before Local state recovery with:

- Game revision: `Revision 274`;
- Snapshot: human label;
- Snapshot id: full id in a wrapping/code-style value;
- Source: source name plus short commit, with full commit available;
- Generated: validated timestamp; and
- Pricing: `Uses the active PriceSet shown in Economy; setup transfers do not
include prices.`

This section is always visible in Settings for a ready app. It has no refresh,
switch or download action. Do not expose the local `.sources` path or generator
command in browser UI.

## Shared transfer context stamp

Define one strict app-state schema independent from the generated snapshot
schema:

```ts
interface SetupTransferContextV1 {
  gameDataId: string;
  gameRevision: number;
}
```

Bounds:

- `gameDataId`: trimmed 1–160 characters, restricted to current safe entity-id
  characters;
- `gameRevision`: integer 1–9,999; and
- strict object with no source path, commit, timestamp, prices or user data.

Build it only from a validated ready `GameDataSnapshot`. It is enough to
compare content revision and exact generated artifact. The app's detailed
source context remains local UI metadata and does not need to be copied into
every user file/link.

## Context comparison

Normalize every parsed transfer into a review context that can be absent for a
legacy format:

```ts
type SetupTransferContextMatch =
  "exact-snapshot" | "same-revision" | "different-revision" | "unknown";
```

Derive in this order:

1. no source context -> `unknown`;
2. same `gameDataId` and revision -> `exact-snapshot`;
3. same revision, different id -> `same-revision`;
4. otherwise -> `different-revision`.

If an id matches but the revision differs, classify `different-revision` and
treat it as suspicious metadata. Do not silently trust the matching id.

Required review copy:

| Match                | Copy                                                                                                                                | Tone    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `exact-snapshot`     | `Created with this exact Revision 274 data snapshot.`                                                                               | ready   |
| `same-revision`      | `Created with another Revision 274 snapshot. Available ids are compatible, but results may differ.`                                 | warning |
| `different-revision` | `Created for Revision <X>; this app uses Revision 274. Available ids are compatible, but combat, loot and requirements may differ.` | warning |
| `unknown`            | `This older format does not record a game revision. It will use the current Revision 274 data.`                                     | warning |

When a source revision cannot be known, never invent `<X>` from an id. Use the
unknown copy.

Context comparison is advisory. After it, existing setup compatibility checks
must still validate every monster, weapon, ammo, spell, gear, prayer, boost and
other required id against the active snapshot. Unavailable critical ids reject
the artifact. Shareable stale loot-row policy remains its own documented
drop-with-count exception.

## Full rewrite setup file contract

Stop using `SavedSetupEnvelopeSchema` as both local persistence and external
file format. Keep the browser contract unchanged:

```ts
{
  version: REWRITE_SETUP_VERSION, // 3
  savedAt: string,
  data: SavedSetupState
}
```

Introduce a dedicated external envelope:

```ts
interface RewriteSetupTransferEnvelopeV1 {
  kind: "index-sim-rewrite-setup";
  version: 1;
  exportedAt: string;
  context: SetupTransferContextV1;
  data: SavedSetupState;
}
```

New exports use this envelope and retain the current filename and 250 KB import
limit. Rename the old schema internally to clarify storage ownership if useful,
but do not alter persisted JSON or its recovery descriptor.

The parser accepts both:

- the new strict kind/version-1 transfer envelope; and
- the current strict version-3 storage-shaped legacy export as context
  `unknown`.

It rejects other kinds/versions with format-specific sanitized copy. The
[setup replacement Review/Undo specification](setup-replacement-review-undo-spec.md)
owns when the parsed candidate is applied; add this context match/copy to that
review before its explicit Apply.

## Saved Duel setup collection file contract

Keep `DUEL_SNAPSHOTS_VERSION = 1` and the browser-local state schema unchanged.
Introduce a separate transfer envelope:

```ts
interface DuelSnapshotsTransferEnvelopeV1 {
  kind: "index-sim-saved-setups";
  version: 1;
  exportedAt: string;
  context: SetupTransferContextV1;
  data: DuelSnapshotsState;
}
```

New collection exports use the contextual envelope and current filename/import
size limit. The parser continues to accept the prior strict
`{ version: 1, exportedAt, data }` envelope as context `unknown`.

After strict parse and active-snapshot entity validation, show an in-memory
review with:

- setup count;
- complete unchanged, matching-ID replacement, addition and capacity-excluded
  classifications against an exact current-collection fingerprint;
- default Keep plus explicit Replace decisions for matching IDs, selectable
  additions, recipient-name validation and source-backed replacement diffs;
- context match copy; and
- `Merge selected setups` / `Dismiss` actions.

Do not merge or persist before `Merge selected setups`. Exact-snapshot, same-revision,
different-revision and unknown formats all use the same explicit review; tone
differs. A changed recipient collection makes decisions stale until Refresh.
[The saved setup Merge and rename safety specification](saved-setup-merge-rename-safety-spec.md)
owns row decisions, name/capacity policy and the direct transaction. Context
comparison remains owned here; Workspace and legacy retain their separate
ID-wins merge boundaries and the 12-row cap remains unchanged.

## Shareable link contract

New links use a backward-compatible version-2 envelope:

```ts
interface ShareableSetupEnvelopeV2 {
  kind: "index-sim-setup";
  version: 2;
  context: SetupTransferContextV1;
  data: ShareableSetupDataV1;
}
```

Keep the same fragment key, encoded/decoded size limits, canonical JSON,
base64url, clipboard, privacy and review-before-load workflow. The parser must
continue to accept v1 and normalize its existing `gameDataId` to:

- exact snapshot only when it equals the current id; and
- `unknown` revision context when it differs, because v1 does not record a
  game revision.

Do not infer v1 revision from the id. New v2 links use the shared context
comparison table. The share-create dialog shows `Revision 274`; the receive
review shows context copy plus the existing price and dropped-loot-row notes.

## Transfer review and result semantics

- Parsing/validation creates only an in-memory candidate.
- No transfer context, candidate or review status enters localStorage.
- Dismiss leaves live and persisted state unchanged.
- Apply/Merge always uses the recipient's current generated snapshot and active
  PriceSet.
- Different/unknown context requires the same explicit button as exact context;
  do not add a hidden bypass or checkbox.
- After Apply/Merge, success copy includes the source context when non-exact,
  for example `Imported setup using current Revision 274 data.`
- Undo, where the owning workflow provides it, restores state but does not
  change the active app revision.
- Export timestamps are metadata only and are never described as the game-data
  generation time.

## Security and privacy

- Treat every file/link and its context stamp as untrusted external input.
- Enforce encoded/text size and duplicate-key checks before schema work.
- Use strict schemas and bounded values; never render raw parser/Zod errors.
- Context metadata never authorizes an id. Active game-data compatibility is
  always revalidated.
- Do not include player name, Hiscores source, prices, local-state health,
  absolute paths, tokens or raw provenance in transfer context.
- Do not fetch a source commit or revision referenced by an artifact.

## Accessibility and responsive behavior

- The topbar revision text and Settings labels are programmatically associated
  and readable without color.
- Long snapshot ids and commits wrap or scroll inside their own values without
  horizontal document overflow.
- Context review status is visible text associated with the relevant setup
  review; warnings use a polite status unless validation itself fails.
- Apply/Merge and Dismiss remain native buttons in logical reading order.
- A context warning does not steal focus or repeatedly announce during
  unrelated calculations.

## Implementation sequence

1. **Done 2026-07-19:** add revision-context
   schema/generator/source-pin/readiness contracts and
   regenerate Revision 274 artifacts with impact evidence.
2. **Done 2026-07-19:** add the pure runtime presentation helper and shared
   transfer-context stamp/comparison helper.
3. **Done 2026-07-19:** render the topbar badge and Settings
   calculation-context section.
4. **Done 2026-07-19:** split rewrite setup storage and external transfer
   envelopes while retaining legacy-file parsing.
5. **Done 2026-07-19:** split Duel storage and external transfer envelopes and
   add merge review.
6. **Done 2026-07-19:** add shareable v2 generation plus v1
   parsing/normalization.
7. **Done 2026-07-19:** add mismatch/unknown browser paths and complete
   feature documentation evidence.

### Implemented first-slice evidence

- Raw generation requires explicit `--game-revision 274`, writes the same
  revision/source/commit/generated-at context to the snapshot and source pin,
  and validates their agreement before output.
- Generic legacy/reference snapshots may still omit revision context, while
  the root generated bootstrap and readiness path reject a missing context.
- The committed Revision 274 snapshot, source pin and current impact report
  were regenerated from the existing pinned local source. The representative
  suite remains 11/11 passing; the refreshed 189-evaluation informational scan
  finds 38 outliers and shows the configured first 25.
- The ready header exposes the text badge `Revision 274`; Settings exposes the
  structured Calculation context and active-PriceSet semantics without source
  paths or generator commands.
- Focused generator/schema/runtime/presentation tests pass 89/89, runtime
  readiness is `ready` with zero blockers, and the focused production-preview
  Chromium path passes at both normal and 390 px widths.

The first-slice results completed implementation-sequence steps 1 and 3 plus
the runtime half of step 2.

### Implemented transfer-slice evidence

- `SetupTransferContextV1` is one strict revision-plus-snapshot stamp. Its pure
  comparison covers exact snapshot, same revision, different revision,
  id/revision conflict and unknown legacy context with deterministic copy.
- New rewrite setup files use dedicated kind/version 1 envelopes and retain the
  250 KB limit and filename. The parser still accepts strict storage-shaped
  version 3 files as unknown context; browser storage remains version 3.
- New saved-setup files use dedicated contextual kind/version 1 envelopes.
  Prior strict version 1 files remain unknown-context inputs. Parsing produces
  only an in-memory add/update/limit preview; collection mutation and
  persistence start only at `Merge setups`.
- New share links use version 2 context. Version 1 links still parse; a matching
  legacy id is exact and a different id is unknown because no revision is
  inferred. Both create and receive views expose Revision 274 context.
- Existing entity-compatibility gates remain authoritative for every context
  class. Transfer stamps contain no price, player, computed output, source
  commit/path or provenance body, and recipient runtime/PriceSet ownership is
  unchanged.
- Focused context/setup/saved-setup/share/controller/presentation suites pass
  102/102. Five production-preview Chromium transactions pass together, with
  an additional contextual saved-setup Dismiss rerun passing; they prove
  review-before-write, legacy warnings, Merge/Apply/Load, Undo, unchanged
  filenames and exact/same/unknown presentation.

All feature acceptance criteria are implemented. The queue's final integration
goal retains full `npm run verify`, complete browser and visual ownership.

Likely implementation files:

- `src/domain/shared/index.ts` and `src/data/schemas/game-data.ts`;
- `scripts/generate-game-data.ts`, `scripts/game-data-generator-core.ts` and
  generated artifacts/revision-impact evidence;
- generated runtime readiness/report scripts;
- `src/app/view-models/settings.ts` and a transfer-context view-model/state
  module;
- `src/app/components/shell/app-header.tsx`;
- `src/app/components/panes/economy-settings-pane.tsx`;
- `src/app/state/ui-state.ts`, `setup-import.ts`, `duel-snapshots.ts` and
  `shareable-setup.ts`;
- setup/Duel transfer controllers and review components;
- `src/app/App.tsx`; and
- focused generator, schema, transfer, controller and browser tests.

## Required tests and validation

Tests must prove:

- generated Revision 274 snapshot, source pin and impact report contain one
  matching explicit revision/source/commit/generated-at context;
- raw production generation fails without a revision and no partial output is
  written;
- production bootstrap/readiness rejects missing or mismatched context, while
  declared legacy/reference fixtures remain supported;
- header and Settings render exact current values without source paths;
- new setup, Duel and share exports contain strict bounded context and exclude
  prices, player data, computed output and raw provenance;
- current v3 setup files, prior v1 Duel files and share v1 links remain
  importable as unknown-context legacy formats;
- exact, same-revision, different-revision, id/revision-conflict and unknown
  comparisons map to deterministic copy/tone;
- no file/link writes or applies before review confirmation;
- incompatible ids still reject under every context class;
- compatible mismatches can Apply/Merge only through the explicit review;
- transfer round trips preserve setup data and current filenames/size limits;
  and
- recipient PriceSet and active runtime revision remain unchanged after import,
  merge, share load and Undo.

Run at minimum:

```sh
npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/setup-file-transfer-controller.test.ts src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts
npm run data:source-audit
npm run data:source-impact
npm run runtime:readiness
npm run test:golden
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "Revision|Import setup|saved setups|shared setup"
npm run build
git diff --check
```

Regenerate data only from the accepted pinned local source under the existing
manual workflow; do not call a live upstream in tests. Run full `npm run verify`,
the complete functional browser suite and visual comparison because generated
data, the always-visible header and three external contracts change together.

## Acceptance criteria

- Every ready production app visibly identifies `Revision 274`.
- Settings exposes structured snapshot/source context and current-pricing
  semantics without raw paths.
- Generated snapshot and source pin agree on an explicit reviewed revision.
- New setup files, saved-setup files and shared links carry revision plus exact
  snapshot id in dedicated external contracts.
- Existing supported legacy transfer artifacts continue to parse with a
  truthful unknown-context warning.
- Context mismatch is visible before any Apply/Merge, while incompatible ids
  still reject.
- Browser persistence versions and payloads remain unchanged.
- No historical runtime, revision switching, remote fetch or PriceSet embedding
  is introduced.
- Generator/readiness, focused, golden, type, architecture, build, full browser,
  visual and diff gates pass.

## Open questions

None block implementation. User-selectable historical revisions remain the
open architecture question already recorded in `docs/technical/architecture.md`;
this specification deliberately keeps one current accepted runtime.

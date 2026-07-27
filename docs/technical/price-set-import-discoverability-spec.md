# PriceSet import discoverability and surface specification

- Status: implemented
- Date: 2026-07-17
- Owner: technical documentation
- Evidence: verified
- Contract: closed

Decision owner: D-102.

## Purpose

Before D-102, the `Import prices` topbar action looked like a normal end-user
price list import, but accepted a strict full `PriceSet` JSON document and
replaced the browser's complete selected base PriceSet. The same transaction
was also exposed as `Import PriceSet` in Settings and Market, giving one
advanced action three equally prominent surfaces without explaining its format
or replacement semantics.

This specification makes full-PriceSet transfer discoverable without presenting
it as a routine simulator action. It removes the duplicated inputs, retains one
advanced Economy/Market workflow and clearly separates full-set replacement
from the ordinary per-item manual-price correction workflow.

## User problem

The current UI does not let a user determine any of the following before opening
the operating-system file picker:

- whether the file is JSON, CSV or a plain item-to-price map;
- whether imported rows merge with or replace current prices;
- whether a partial file is safe;
- whether high-alch values are imported;
- where a valid example file comes from;
- whether the action is intended for ordinary price correction or advanced
  transfer/reproduction;
- how to undo an accepted import.

The label is especially misleading because `prices.json` in the repository is
not itself the accepted external PriceSet shape. A technically valid partial
PriceSet is also not a patch: its `itemPrices` map becomes the selected base, so
missing items remain missing rather than being filled from the committed
snapshot. The resulting calculation may therefore show incomplete-price issues.

## Verified pre-implementation behavior

The pre-implementation UI had three file inputs backed by the same transaction:

1. topbar `Import prices`;
2. Settings / Price data `Import PriceSet`;
3. Economy or Settings / Market `Import PriceSet`.

The accepted file is bounded to 1,000,000 bytes, duplicate-key checked, parsed as
JSON and validated against the strict `PriceSetSchema`. The required top-level
shape is:

```json
{
  "id": "custom-prices",
  "label": "Custom prices",
  "source": "manual",
  "createdAt": "2026-07-17T08:00:00.000Z",
  "itemPrices": {
    "big_bones": 1000,
    "lobster": 50
  },
  "alchValues": {}
}
```

`itemPriceMetadata` and `provenance` are optional validated fields. Exports from
the app include the active metadata when available and are the preferred source
for a round-trippable file.

After validation, acceptance:

1. replaces incoming high-alch values with current generated Revision 274
   values;
2. installs the imported PriceSet as the complete selected base PriceSet;
3. applies separate browser-local manual item overrides on top;
4. persists the selected base when storage is available;
5. appends the accepted base to capped local comparison history; and
6. updates all monetary calculations using the resulting active PriceSet.

A rejected import changes none of those owners. Reset clears only the selected
full PriceSet and returns to the scheduled snapshot before the bundled fallback;
manual per-item overrides and local history retain their separate policies.

## Accepted product decision

Full PriceSet import remains supported, but only as an advanced local data tool.
It is not a primary topbar action and is not the ordinary way to correct one or a
few item prices.

The accepted canonical use cases are:

- transfer the same calculation-price context between browsers or devices;
- reproduce a shared, historical or test calculation with an exact PriceSet;
- apply a maintainer-provided complete snapshot before a later application
  release; and
- operate in an offline/development environment where the committed snapshot is
  intentionally replaced.

The ordinary user path remains:

- use committed prices without taking any action; or
- use `Manual item price` in Economy for one-off item corrections.

No UI copy may describe full import as a refresh, sync, merge, supplement or
ordinary price edit.

## Implemented information architecture

### Remove from the global topbar

Remove the complete `Import prices` file-button and its topbar-scoped price
notice. The topbar continues to own player lookup and setup transfer/sharing;
market-data administration no longer competes with those global tasks.

The visible setup actions retain their current relative order:

1. `Import setup`;
2. `Export setup`;
3. `Share setup`.

This specification does not otherwise redesign setup transfer.

### Remove the Settings duplicate

Settings / Price data keeps scheduled and active PriceSet diagnostics, but it no
longer renders a second import/export/reset action row. The Market section is
already present in the shared Economy/Settings pane family and becomes the sole
owner of complete PriceSet tools.

### Keep one advanced Market workflow

Economy/Market renders one native disclosure:

```text
Advanced PriceSet tools
```

It is collapsed by default on every page load and is not persisted. Opening it
shows:

1. the replacement warning and format guidance;
2. `Export active PriceSet`;
3. `Import full PriceSet`;
4. `Reset imported PriceSet` when a selected full PriceSet can be reset; and
5. the import/reset notice adjacent to the controls.

The control order intentionally exposes a guaranteed valid export/template
before the destructive-in-effect replacement action. Export remains disabled
when no active PriceSet exists. Import remains a labelled JSON file input.

`Reset imported PriceSet` replaces the ambiguous `Reset local price override`
label. It resets only the selected full PriceSet; it must not imply that manual
item overrides or local price history are cleared.

## Required user-facing copy

The disclosure must include these two short explanatory paragraphs or copy with
the same meaning:

> Importing replaces the complete local base PriceSet in this browser. Missing
> items are not merged from the committed snapshot. Use Manual item price for
> individual corrections.

> Accepted file: a PriceSet JSON exported by this app, up to 1 MB. High alch
> values always come from current game data.

The format help must expose the required field names without requiring the user
to inspect source code. It may use a nested `File format` disclosure containing
the minimal JSON example from this specification. It must also state:

- item ids are the app's canonical item keys;
- prices are finite non-negative numbers;
- `itemPrices` is a complete replacement map, not a patch;
- `alchValues` is required by the file schema but imported values are replaced
  by generated game data; and
- `Export active PriceSet` is the preferred template.

Do not show optional metadata schema details in the primary helper copy. Export
preserves them automatically, while invalid manually authored metadata continues
to use the existing bounded validation error path.

## Interaction contract

### Import

- Only the first selected `.json` file is considered.
- The file input retains `accept="application/json,.json"`; this is a picker
  hint, not validation.
- Selecting no file is a no-op.
- Starting an import clears the previous import notice.
- Success keeps the advanced disclosure open and shows the accepted PriceSet
  label plus the generated-high-alch statement.
- Failure keeps the disclosure open, places the sanitized error beside the
  input and explicitly states that the current PriceSet and history were kept.
- The input value resets after either result so the same file can be retried.
- Import does not silently navigate, close the disclosure or move focus to a
  different workbench tab.

### Export

- Export downloads the unchanged active PriceSet using the existing sanitized
  `index-sim-price-set-<id>.json` filename contract.
- Export is described as both backup and import template.
- Export does not append history or change selected/manual state.

### Reset

- Reset retains the existing explicit confirmation step.
- The request copy names the scheduled or bundled fallback that will become the
  base.
- Confirmation copy states that manual item prices and local history are kept.
- Cancel changes no data.
- Success closes only reset confirmation; the advanced disclosure remains open
  so the resulting active source is visible.

### Manual per-item correction

The existing `Manual item price` panel remains outside the advanced disclosure
and is the visually preferred correction workflow. Its helper text should link
the distinction in both directions:

- full-set help points users to `Manual item price`; and
- the manual panel may state that advanced PriceSet tools replace the complete
  base when users need transfer/reproduction.

No schema, capacity, persistence or generated-metadata behavior of manual item
overrides changes.

## Accessibility and responsive requirements

- Use a native `details`/`summary` disclosure or an equivalent control with
  correct `aria-expanded` and keyboard behavior.
- The summary has one unambiguous accessible name: `Advanced PriceSet tools`.
- The file input is associated with the visible `Import full PriceSet` label and
  the replacement/format help through `aria-describedby` or equivalent native
  structure.
- Success remains a polite status; validation failure remains an alert.
- Confirmation controls remain sequentially reachable and Escape is not
  invented as a non-native requirement.
- Focus remains visible for summary, file input label and buttons.
- The disclosure and its copy wrap inside the center pane at mobile widths;
  action controls may wrap but may not widen the page.
- Removing the topbar button must not leave an empty notice slot or alter header
  height when no other notice exists.

## State, storage and security boundaries

This change introduces no new persisted state, schema or backend:

- disclosure open/closed state is transient and defaults closed;
- selected PriceSet persistence remains version 2;
- local history, manual overrides and recovery state retain separate keys;
- the one-megabyte bound, duplicate-key rejection and strict Zod validation stay
  unchanged;
- no remote URL import, clipboard import, drag-and-drop parsing or live upstream
  request is added; and
- notices remain sanitized and must not expose raw file contents, browser paths,
  parser stacks or unbounded schema output.

Automatic market upstream refresh remains disabled under D-099. This
discoverability change neither re-enables it nor makes imported files
authoritative public market evidence.

## Implemented ownership

The implementation makes these bounded ownership changes:

- `src/app/components/shell/app-header.tsx`
  - remove `priceImportNotice`, `onImportPrices`, the file input and its notice;
- `src/app/App.tsx`
  - stop adapting the PriceSet transfer transaction into topbar props;
- `src/app/components/panes/economy-settings-pane.tsx`
  - remove the Settings / Price data duplicate action row;
  - own the single advanced Market disclosure, helper copy, format example and
    adjacent notice;
- `src/app/components/panes/price-set-import-input.ts`
  - own first-file extraction and unconditional input reset so the pane workflow
    remains directly testable;
- `src/app/controllers/price-set-transfer.ts` and
  `src/app/controllers/use-price-set-transfer.ts`
  - collapse obsolete topbar/settings notice routing to the one canonical Market
    owner without changing acceptance, export or reset transactions;
- `src/app/styles.css`
  - add only disclosure/help/responsive styling needed by the target markup; and
- existing view models
  - expose only current active/reset labels already needed by the pure pane; do
    not move file parsing or browser transactions into the component.

The earlier three-surface preservation requirement in
`price-set-transfer-controller-spec.md` remains historical extraction evidence.
This specification supersedes that presentation requirement; transaction and
ownership boundaries remain authoritative.

## Required tests

### Unit and component tests

- `AppHeader` has no `Import prices` file input or topbar price notice contract.
- Settings / Price data has diagnostics but no duplicate PriceSet action row.
- Economy/Market renders exactly one `Advanced PriceSet tools` summary and one
  PriceSet file input.
- The disclosure is collapsed by default and contains the exact replacement,
  non-merge, manual-price, high-alch and one-megabyte guidance.
- Import, export, reset request/cancel/confirm and import-notice callbacks route
  through the pure pane contract.
- The controller no longer needs three-surface notice discrimination.
- Existing validation, no-change-on-failure, generated-alch authority,
  persistence, latest-state history update and reset tests remain green.

### Browser tests

- The global action list is exactly `Import setup`, `Export setup`, `Share setup`.
- Both Economy and Settings routes expose only the canonical Market disclosure,
  never two import inputs in the same active pane.
- Opening the disclosure reveals format help and all enabled controls.
- Exported active PriceSet JSON can be imported back successfully.
- A valid intentionally partial PriceSet is accepted as a replacement and the UI
  explains/reflects missing values rather than merging committed prices.
- Malformed, oversized, duplicate-key and schema-invalid files retain the active
  PriceSet, selected persistence and history and show a local sanitized error.
- Reset returns to the named fallback while preserving manual item prices and
  local history.
- Mobile/tablet smoke confirms no header or Market page overflow.

### Validation commands

The implementation pass must run:

```sh
npm run typecheck
npm run test -- src/tests/price-set-transfer-controller.test.ts src/tests/economy-settings-pane.test.ts src/tests/app-shell-components.test.tsx
npm run test:e2e -- --workers=1 --grep "PriceSet|global actions|compact landscape|mobile viewport"
npm run verify
```

If browser execution is unavailable, the handoff must state which named cases
were not run; unit rendering alone is not completion evidence for the global
action removal and responsive disclosure.

## Acceptance criteria

The implementation is complete only when all of the following are true:

- no global `Import prices` action remains;
- no Settings / Price data duplicate import/export/reset row remains;
- exactly one advanced full-PriceSet workflow exists under Market;
- the UI says that import replaces the complete base and does not merge missing
  items;
- the UI directs individual corrections to `Manual item price`;
- a user can obtain a valid template through `Export active PriceSet` and inspect
  the required minimal fields before choosing a file;
- import/export/reset numeric, persistence, generated-alch and history semantics
  are unchanged;
- existing selected PriceSets require no migration and remain restorable;
- invalid imports remain non-fatal and locally explained;
- responsive and keyboard behavior is browser-covered; and
- owning product, architecture, testing and implemented controller docs are
  updated from target to current truth in the same implementation change.

## Implemented result

- The global header now contains only setup import/export/share actions beside
  Hiscores; it has no PriceSet input or price-import notice contract.
- Settings retains Price data diagnostics and Gear controls but no longer owns
  a duplicate PriceSet import/export/reset row.
- The shared Market section owns one collapsed native
  `Advanced PriceSet tools` disclosure with replacement/non-merge guidance,
  the manual-item-price distinction, a minimal `File format` example and the
  export/import/reset controls in the accepted order.
- Price import notices are no longer surface-tagged. The controller keeps one
  canonical notice adjacent to the Market tools while preserving bounded file
  parsing, generated high-alch authority, selected persistence, latest-state
  history updates and non-fatal rejection.
- Reset copy now names the imported PriceSet boundary and explicitly preserves
  manual item prices and local history.
- Focused component/controller coverage owns the one-disclosure DOM contract,
  action routing and unchanged transaction semantics. Browser coverage owns
  the global action removal, successful full-PriceSet round trip, recoverable
  failures and compact/mobile containment.

## Out of scope

- accepting CSV or a bare item-to-price map;
- merging partial PriceSets into the committed snapshot;
- changing required PriceSet fields or metadata validation;
- importing high-alch authority from external files;
- remote URL, clipboard or drag-and-drop imports;
- automatic upstream refresh or scheduled workflow re-enablement;
- changing shared or local price-history retention;
- changing manual item override capacity or schema; and
- redesigning setup import/export/share controls beyond removing the unrelated
  price action from their global group.

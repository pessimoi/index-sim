# User-friendly price date and time presentation specification

Status: implemented on 2026-07-20.

Priority: medium.

Estimated effort: S.

## Purpose

Replace raw or context-poor price timestamps with consistent human-readable
local date, time and age presentation while preserving the semantic difference
between PriceSet creation, snapshot capture, item observation, refresh
evaluation, manual update and local comparison capture.

The project already stores and validates the facts needed for truthful
presentation. This specification changes how those facts are named and shown;
it does not change a price, timestamp, freshness threshold, history point or
persisted contract.

## Feature-inventory check

- `Market price sync` and `Loot/economy summary` are `Valmis` in
  [the feature inventory](../product/feature-inventory.md). Scheduled, bundled,
  selected and manually overlaid prices, aggregate provenance, selected-item
  detail, shared/local history and current-result warnings are implemented.
- D-085 and the implemented
  [per-item price provenance and freshness contract](per-item-price-provenance-freshness-spec.md)
  already require PriceSet capture/creation time, item observation time and
  refresh evaluation time to remain distinct. This follow-up presents that
  existing truth; it does not redefine it.
- the proposed
  [local price-history lifecycle contract](local-price-history-lifecycle-management-spec.md)
  deliberately defers localized visible dates to this owner while requiring
  semantic timestamps and `<time dateTime>` markup.
- the implemented user-facing language contract keeps current product UI in
  English and does not add a locale selector. This specification follows that
  boundary.
- no roadmap/backlog item currently owns a complete price-specific date/time
  formatter or the raw-ISO cleanup below. This is a separate presentation gap,
  not a duplicate market-data feature.
- Market and Economy remain `Valmis` during and after implementation.

## Verified current behavior and gap

The following is verified against the production rewrite on 2026-07-20:

- scheduled and active Market summaries render `PriceSet.createdAt` directly as
  an ISO-like string under the generic label `Created`;
- Manual item price renders `ManualPriceOverride.updatedAt` directly;
- selected-item provenance renders `valueObservedAt` and `evaluatedAt`
  directly, or a bare dash when absent;
- history Snapshot options concatenate the label and raw `capturedAt` value;
- mover baseline labels include raw `capturedAt` in parentheses;
- trend point SVG titles use raw `capturedAt`, while the visible point list
  slices the first ten characters and therefore shows only `YYYY-MM-DD`;
- most of these timestamps are ordinary `<span>` text rather than semantic
  `<time dateTime>` elements;
- the current `Age` formatter returns compact durations such as `<1 min` or
  `1 day`, but does not say whether the value is in the past, pair it with an
  exact date or preserve a future timestamp;
- PriceSet age derivation clamps future values to zero before formatting;
- `PriceSetSchema` retains compatibility with date-only and older free-form
  `createdAt` strings, while item metadata, manual override and history capture
  fields are strict ISO instants;
- `priceAgeNowMs` already updates once per minute and is the accepted UI clock
  for age/freshness presentation;
- the visual fixture clock is fixed, but Playwright does not currently pin an
  explicit time zone; and
- the state/domain layers correctly sort and identify history with canonical
  timestamps. Presentation must not replace those raw values in keys or
  calculations.

The user gap is trust and comprehension. A raw value such as
`2026-07-20T00:00:00.000Z` is difficult to scan, a date-only slice hides local
time and multiple same-day captures, and generic `Created`/`Age` wording can
make a recent writer evaluation look like a recent observation of every item.

## Goals

- Introduce one pure price date/time presentation contract.
- Use the current English UI language with the user's browser time zone and an
  explicit visible zone abbreviation for instant-precision facts.
- Pair exact local date/time with a compact past/future relative value where
  the surface benefits from age.
- Preserve date-only precision without inventing a clock time or time zone.
- Replace raw ISO and `YYYY-MM-DD` ordinary UI copy across Market, manual price,
  selected provenance, snapshot choices, history summaries, trend points and
  the expanded Loot history context.
- Use semantic field labels that distinguish created/captured/observed/
  evaluated/updated.
- Keep canonical ISO source values in `<time dateTime>`, internal identities,
  comparison/sort logic and technical transfer formats.
- Give missing and unrecognized values explicit bounded copy rather than a bare
  dash or `Invalid Date`.
- Keep relative values correct through the existing minute clock without live-
  region noise or expensive history reanalysis.
- Make deterministic unit, DST, browser and visual evidence possible through
  injected clock/time-zone context.

## Non-goals

- No timestamp generation, correction, backfill, migration or source inference.
- No change to `PriceSet`, item metadata, manual-price, selected-PriceSet,
  browser-history, shared-history, provenance sidecar or Workspace schemas.
- No change to D-085 meanings, the 30-day freshness threshold, writer
  retention, history ordering/compaction, price calculations or warnings.
- No locale selector, language catalog or Finnish UI localization.
- No user-configurable 12/24-hour clock or date pattern in this slice.
- No server/client clock synchronization, network time service or automatic
  system-time warning.
- No formatting change to Hiscores, game revision, setup/workspace exports,
  local-state reports or non-price timestamps.
- No change to exported JSON, JSON examples, filenames, storage envelopes,
  technical IDs or canonical `dateTime` attributes.
- No chart resampling, new market observation, provider call, backend,
  database, auth, deployment or scheduled-workflow change.
- No automatic live announcements when only an age label advances by one
  minute.

## Semantic time inventory

Every visible price time must retain the following meaning:

| Field                                                    | User-facing label                                                         | Meaning                                                      | Must not imply                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| scheduled `PriceSet.createdAt` / provenance `capturedAt` | `Snapshot captured`                                                       | the committed logical price artifact capture                 | every item was observed then                   |
| bundled/selected `PriceSet.createdAt`                    | `Price set created`                                                       | source artifact or imported set creation                     | market observation for every item              |
| manual-overlay `PriceSet.createdAt`                      | `Active prices updated`                                                   | latest active manual override update used to compose the set | base snapshot capture or market refresh        |
| `BrowserPriceHistorySnapshot.capturedAt`                 | `Comparison captured` for local rows; `Snapshot captured` for shared rows | time the as-of comparison point was recorded                 | item observation unless metadata says observed |
| `ItemPriceMetadata.valueObservedAt`                      | `Value observed`                                                          | accepted source evidence that established the current value  | latest evaluation or snapshot capture          |
| `ItemPriceMetadata.evaluatedAt`                          | `Last evaluated`                                                          | latest applicable refresh attempt                            | accepted replacement or current value age      |
| `ManualPriceOverride.updatedAt`                          | `Manual price updated`                                                    | local manual value edit time                                 | market evidence                                |

`latestCandidateAt`, `verifiedAt`, selected-PriceSet `selectedAt`, storage
`savedAt` and transfer `exportedAt` remain outside ordinary Price history copy in
this slice. They are not substituted for a missing observation/evaluation time.
If a later UI exposes one, it must receive a separate semantic decision rather
than inherit a generic `Updated` label.

## Display locale and time zone policy

The visible price date/time policy is:

- locale: fixed `en-GB`, matching the current English UI while using an
  unambiguous day-month-name order and 24-hour time;
- time zone: the user's browser-resolved IANA time zone;
- fallback time zone: `UTC` when resolution is unavailable or rejected; and
- zone visibility: include a short zone name on every instant-precision exact
  date/time.

Examples for a browser in `Europe/Helsinki`:

```text
20 Jul 2026, 03:00 EEST
5 Jan 2026, 02:00 EET
```

Examples in the deterministic `UTC` test context:

```text
20 Jul 2026, 00:00 UTC
5 Jan 2026, 00:00 UTC
```

This does not add a locale preference. Numbers retain their existing formatter
and input syntax. Only price date/time presentation uses this contract.

Resolve the browser time zone once per page session. Do not change persisted
state when the system zone changes. A reload may render the same canonical
instant in the newly resolved local zone.

## Accepted input precision

The formatter recognizes only:

1. a valid ISO-8601 instant with an explicit `Z` or numeric offset;
2. a valid calendar date in exact `YYYY-MM-DD` form;
3. an absent value; or
4. an unrecognized/invalid value.

Do not use permissive locale-dependent `Date.parse` for arbitrary display
strings.

### Instant precision

An instant is converted to the selected browser time zone. It receives exact
local, exact UTC and relative presentation.

### Date-only precision

A date-only value renders as, for example, `5 Jul 2026`.

- do not append `00:00`, UTC or a browser zone;
- do not calculate a minute/hour age;
- compact age surfaces use `Exact time not recorded`; and
- `<time dateTime>` retains the original date-only value.

This preserves compatibility with older PriceSet fixtures/files without
inventing precision.

### Missing value

Use semantic copy:

- observation/evaluation/manual update: `Not recorded`;
- non-applicable market time for manual/generated values: `Not applicable`;
- unavailable PriceSet/history fact: `Unavailable`.

The owning view model chooses among these fixed states. Do not render a bare
dash where the field label is otherwise visible.

### Invalid value

Use `Date unavailable` and a safe accessible description such as `The stored date could not be displayed.`

- do not expose the invalid raw value;
- do not throw or render `Invalid Date`;
- do not use the value for relative time; and
- do not tighten existing external/storage schemas in this presentation change.

Invalid strict item/history/manual timestamps should remain impossible after
their existing validation. The fallback is required for compatible PriceSet
`createdAt` and defensive rendering.

## Pure presentation contract

Add a pure view-model helper, named to fit the repository but equivalent to:

```ts
interface PriceTimeContext {
  now: Date;
  locale: "en-GB";
  timeZone: string;
}

type PriceTimePrecision = "instant" | "date" | "missing" | "invalid";

interface PriceDateTimePresentation {
  precision: PriceTimePrecision;
  dateTime: string | null;
  exactVisible: string;
  exactAccessible: string;
  exactUtcTitle: string | null;
  relativeVisible: string | null;
  relativeAccessible: string | null;
}
```

`dateTime` contains only the validated original canonical instant/date for the
HTML attribute. It must never be used as ordinary visible copy.

The helper must:

- be deterministic for the same value/context;
- catch `Intl`/time-zone errors and retry in UTC;
- never mutate input `Date` or global locale/time-zone state;
- never round or alter a stored source timestamp;
- keep exact and relative strings separate so each surface can choose a compact
  or full rendering; and
- remain independent from React, DOM, storage, domain calculations and network
  code.

## Exact date/time copy

For instant precision:

- visible exact uses abbreviated English month, four-digit year, two-digit
  24-hour time and short zone;
- accessible exact uses full English month and an available long zone label;
- title/technical exact uses the equivalent human-readable UTC value; and
- seconds are omitted by default.

If two selectable history points collapse to the same displayed local minute,
show seconds for those colliding options. If their canonical instants also
match, append a stable visible ordinal (`1 of 2`) based on current analysis
order. Do not expose the source PriceSet ID as the ordinary disambiguator.

For date-only precision, exact visible/accessibility contains only the calendar
date.

## Relative-time copy

Relative time is signed; future timestamps are not clamped to the present.

| Absolute distance | Visible past | Accessible past          | Visible future          |
| ----------------- | ------------ | ------------------------ | ----------------------- |
| under 60 seconds  | `just now`   | `less than 1 minute ago` | `in less than 1 minute` |
| under 60 minutes  | `N min ago`  | `N minute(s) ago`        | `in N min`              |
| under 24 hours    | `N hr ago`   | `N hour(s) ago`          | `in N hr`               |
| 24 hours or more  | `N days ago` | `N day(s) ago`           | `in N days`             |

Use whole units rounded down after the under-one-unit case, with a minimum of
one. Keep existing accessible singular/plural behavior. The exact local value
is always available on full surfaces and in the compact time element's
accessible name/title, so relative rounding never replaces the source fact.

Date-only, missing and invalid values have no relative value.

## Semantic markup component

Use one small presentational component or equivalent shared markup contract.

For a valid value:

```tsx
<time
  dateTime={presentation.dateTime}
  title={presentation.exactUtcTitle ?? undefined}
  aria-label={presentation.exactAccessible}
>
  {presentation.exactVisible}
</time>
```

When a compact surface shows relative text instead, the same `<time>` keeps
canonical `dateTime`, uses relative visible copy and an accessible name that
contains relative plus exact local meaning. Full surfaces may render exact and
relative as adjacent text, but must not create two independently announced
copies of the same fact.

For missing/invalid values, render ordinary text rather than an invalid `<time>`.

Do not rely on hover title as the only available date. Do not add a live region
to the shared component.

## Market and Settings presentation

### Scheduled snapshot

Replace:

```text
Created <raw timestamp>
Age <duration>
```

with:

```text
Snapshot captured <exact local date/time>
Captured <relative time>
```

The existing status, label, source, counts, fallback and disabled-refresh copy
remain unchanged. `Captured` never implies that every item was observed then.

### Active PriceSet

Choose the exact label from the current source state:

- active manual overrides: `Active prices updated`;
- scheduled origin: `Active snapshot captured`;
- bundled origin: `Bundled price set created`; and
- selected origin: `Selected price set created`.

Show exact local date/time plus `Age <relative>` when instant precision exists.
For date-only input, show the date and `Exact time not recorded` instead of a
relative age.

The compact Settings Price data summary shows one relative time fact with the
same semantic label and exact local value in its accessible name. It does not
duplicate the complete Market timestamp block.

## Manual item price presentation

Replace raw `Updated` with:

```text
Manual price updated <exact local date/time> · <relative time>
```

When no override is selected, show `Manual price updated Not applicable` or
omit the complete fact consistently; do not show a bare dash.

Applying a manual price continues to create one existing canonical ISO update
time. Formatting must not trigger Apply, history capture, persistence or Undo.

## Selected item provenance presentation

Keep Origin, Refresh, Freshness, Quality and Reason as separate facts.

Replace raw fields with:

- `Value observed <exact local date/time> · <relative time>`;
- `Last evaluated <exact local date/time> · <relative time>`.

Rules:

- market observation with a known value time shows both exact and relative;
- retained market value may show an older `Value observed` and newer `Last
evaluated` at the same time. Do not merge them;
- market/imported/legacy metadata without a trusted observation uses `Not
recorded`;
- manual or generated-object-cost origin uses `Not applicable` for observation;
- `not-evaluated`/`not-applicable` without `evaluatedAt` uses `Not evaluated`;
  and
- freshness derivation continues to use canonical observation time and the
  unchanged 30-day rule, not formatted text.

The fixed price-freshness warning `Price date unknown` remains truthful and is
not suppressed merely because a PriceSet creation or evaluation time exists.

## Price history presentation

### Snapshot selector and summary

- selector option: `<Snapshot label> · <exact local capture time>`;
- latest summary: show label plus formatted capture time;
- baseline summary: show label plus formatted capture time; and
- selection identity remains the canonical
  `capturedAt::sourcePriceSetId` key.

Do not put relative time into every selector option; exact values are more
stable for choosing historical points. The summary may show relative Latest
age through the shared formatter.

### Trend point list and chart

Every trend point presentation carries:

- formatted snapshot capture time;
- optional formatted item observation time from that snapshot's item metadata;
- optional formatted evaluation time;
- existing observed/retained/carried-forward/legacy/local status; and
- numeric price/delta unchanged.

The visible point list uses exact local capture date/time, not a sliced ISO
date. SVG `<title>` copy uses the same friendly time and status.

For an observed or retained point, accessible/tooltip detail distinguishes:

```text
Snapshot captured ...; value observed ...; last evaluated ...
```

Omit unavailable clauses; never substitute capture time for observation time.

Sparkline accessible names add the first and latest formatted capture dates to
the existing price sequence summary. Chart geometry and point ordering remain
unchanged.

### Local lifecycle management

When the proposed local-history lifecycle surface is implemented, every local
row, next-replacement preview, removal review and replacement review uses this
formatter for `capturedAt`.

- accessible action names still include the snapshot label and capture time;
- duplicate canonical identities remain resolved by the lifecycle occurrence
  key, not formatted display text; and
- same-minute collisions follow the seconds/ordinal disambiguation rule.

No implementation may retain a parallel ISO-visible branch after both specs
land.

## Expanded Loot history context

The existing expanded Loot row consumes the combined shared/local analysis but
currently shows Latest/Baseline prices without their prepared snapshot labels.

Rename its heading from `Local history` to `Price history` and show compact
capture facts:

- `Latest <price> · <formatted latest capture>`; and
- `Baseline <price> · <formatted baseline capture>`.

This uses the same analysis points already selected in Economy. It adds no
price source, duplicate provenance editor or new Loot calculation. Missing
history retains the existing bounded empty states.

## Clock and recomputation boundary

Reuse the existing `priceAgeNowMs` minute clock.

- resolve locale/time-zone context once;
- update relative presentation no more often than the existing minute tick;
- absolute strings may be memoized by canonical value and time zone;
- keep shared/local history merge, mover sort/filter and trend price analysis in
  memos that do not depend on the minute clock;
- build a lightweight time-presentation layer over the completed analysis; and
- do not rebuild calculations, simulation view models or the calculation Worker
  because an age label changed.

Manual Apply, PriceSet acceptance and explicit Save local comparison may update
the clock immediately through their existing paths. A background minute tick
does not mutate storage or history.

## Accessibility contract

- Every recognized visible source value uses `<time dateTime>` with the
  canonical date/instant.
- Date-only values remain date-only in `dateTime`.
- Missing/invalid states are readable text, not empty time elements.
- Short `min`/`hr` relative labels have full accessible singular/plural copy.
- Time-zone meaning is present in visible full surfaces and accessible compact
  surfaces.
- Observation, evaluation and capture labels remain visible; color and hover
  are never their only distinction.
- Updating relative text each minute is not an `aria-live` event and must not
  move focus.
- Trend SVG and point list do not announce raw ISO strings or duplicate one
  point twice through redundant labels.
- At 200% zoom and in forced-colors mode, exact/relative text remains readable
  and does not overlap adjacent price/status facts.
- Technical JSON examples may retain canonical ISO text because they document
  a machine contract; they must remain inside their labelled advanced
  disclosure and are not ordinary status copy.

## Responsive and visual contract

At 1440 x 1000 desktop:

- exact date/time and relative age wrap within existing Market/history summary
  chips without increasing the document scroll owner;
- selected provenance keeps Observation and Evaluation as distinct facts; and
- 20 trend rows remain readable in the existing Price history flow.

At 640 x 360 compact landscape and 390 x 844, 620 x 844 and 768 x 1024
normal-flow layouts:

- long month/zone labels wrap without horizontal document overflow;
- summary chips may wrap to additional rows but never clip a time or action;
- snapshot selector text truncates only through its existing labelled combobox
  behavior while the full accessible label remains available;
- trend point time/price/status rows stack or wrap without shrinking below the
  accepted text minimums; and
- expanded Loot Price history remains contained in its existing row detail.

Expected visual owners are Economy desktop/trend, Settings price summary and
expanded Loot history. Do not update unrelated baselines.

## Failure, privacy and security

- Invalid/unsupported time zones fall back to UTC without surfacing raw
  exceptions.
- Invalid date input renders fixed copy and never reaches logs or the DOM.
- Do not expose source HTML, upstream payloads, usernames, tokens, absolute
  paths or raw imported storage around a timestamp.
- Browser time-zone name is presentation state only and is never persisted,
  exported, logged or sent to a provider.
- Relative formatting does not change freshness, warning severity or numeric
  calculation.
- A local clock in the future or past may produce future/past relative text;
  exact canonical/local time remains visible so the UI does not conceal it.
- No locale/time-zone formatting failure may make Market, Economy or Loot
  unavailable.

## Architecture and ownership

- `src/domain/shared` and `src/domain/economy` retain timestamp meanings and
  freshness calculation; they do not format user copy.
- `src/app/state/price-history.ts`, manual-price and selected-PriceSet state
  retain canonical timestamps, identity, ordering and persistence.
- a pure helper under `src/app/view-models` owns price date parsing, locale/time-
  zone formatting, relative copy and missing/invalid presentation.
- `src/app/view-models/price-data.ts` assigns semantic labels and builds Market,
  manual, provenance, snapshot and history-time presentations.
- `src/app/view-models/loot.ts` consumes already-formatted latest/baseline
  capture facts; it does not parse dates independently.
- one shared app component owns semantic `<time>` markup.
- Economy/Settings, history-chart and Loot components render presentation data
  without slicing/parsing source strings.
- `src/app/App.tsx` owns the existing minute clock and one resolved time-zone
  context.
- Playwright configuration owns deterministic test time zone; fixture helpers
  own deterministic clock values.

No state/domain-to-React dependency or architecture exception is allowed.

## Implementation slices

### Slice 1: pure contract

1. define recognized instant/date-only/missing/invalid parsing;
2. implement exact local, accessible, UTC-title and signed relative strings;
3. add browser-zone resolution with UTC fallback;
4. cover DST, offset, date-only, future and invalid cases; and
5. add the semantic `<time>` component.

### Slice 2: Market, manual and provenance

1. replace scheduled and active raw Created/Age fields;
2. adapt compact Settings active price time;
3. format manual override update time;
4. format and separately label observation/evaluation times; and
5. retain freshness/reason copy and no-record/not-applicable distinctions.

### Slice 3: history and Loot

1. build friendly selector/latest/baseline capture presentation;
2. add trend capture/observation/evaluation time data without changing point
   math;
3. replace chart/list raw ISO/date slicing;
4. add date ranges to sparkline accessibility;
5. route local lifecycle rows/reviews through the same helper; and
6. show latest/baseline captures in expanded Loot Price history.

### Slice 4: deterministic browser and visual closure

1. pin UTC in functional/visual Playwright projects;
2. keep fixed visual clock and update only time-owned fixtures/assertions;
3. exercise user-zone formatting in pure/component tests separately;
4. review Economy/Settings/Loot desktop/compact/mobile visual diffs;
5. run full functional, golden, architecture, build and diff gates; and
6. promote implementation evidence to living docs.

## Expected implementation files

Likely source owners:

- a new pure price-time view-model helper
- a small shared semantic-time component
- `src/app/view-models/price-data.ts`
- `src/app/view-models/loot.ts`
- `src/app/components/panes/economy-settings-pane.tsx`
- `src/app/components/price-history-charts.tsx`
- `src/app/components/panes/loot-pane.tsx`
- `src/app/App.tsx`
- `src/app/styles.css`
- `playwright.config.ts`
- `playwright.visual.config.ts`

Potentially touched after the earlier lifecycle implementation:

- its local-history lifecycle view model/pane tests, but not state identity,
  persistence or transaction logic.

Likely evidence owners:

- a focused price date/time formatter test
- `src/tests/price-data-view-model.test.ts`
- `src/tests/economy-settings-pane.test.ts`
- `src/tests/loot-view-model.test.ts`
- focused price-history chart/component coverage
- `src/tests/e2e/integrations-economy.spec.ts`
- `src/tests/e2e/cannon-trip-loot.spec.ts`
- visual Economy/Settings/Loot scenarios

## Required automated evidence

### Pure formatter tests

Prove at minimum:

- UTC `Z` and positive/negative-offset instants resolve to the same instant;
- `Europe/Helsinki` winter/summer output crosses EET/EEST correctly;
- UTC fallback after invalid zone;
- cross-midnight and cross-year local conversion;
- leap-day validity and invalid calendar-date rejection;
- date-only output never invents time/zone/relative age;
- missing and invalid fixed copy contains no raw input;
- just-now, minute, hour and day singular/plural boundaries;
- signed future copy without zero-clamping;
- canonical `dateTime` remains byte-identical;
- deterministic exact UTC title; and
- same-minute collision seconds/ordinal disambiguation.

### View-model and component tests

Prove at minimum:

- scheduled, bundled, selected and manual active sources receive the correct
  semantic label;
- compact Settings and full Market use one underlying time fact;
- manual selection/no-selection update copy;
- observed and evaluated times remain separate for observed and retained rows;
- imported/legacy/manual/generated missing/not-applicable copy;
- invalid compatible PriceSet createdAt remains non-fatal;
- snapshot option IDs stay canonical while labels become friendly;
- latest/baseline identity, ordering and values remain unchanged;
- trend point status, price, delta and ordering remain unchanged while time
  copy becomes friendly;
- capture never substitutes for missing observation;
- sparkline accessible range dates;
- expanded Loot latest/baseline captures use the same presentation; and
- every valid rendered fact uses `<time dateTime>` with no visible raw ISO.

### Clock and performance tests

Prove at minimum:

- one minute tick updates relative labels at boundaries;
- the tick triggers no persistence, history append, price acceptance,
  calculation task or live announcement;
- mover/trend price analysis object identity or measured work is not rebuilt
  solely for an age tick; and
- time-zone resolution occurs once per app session with UTC fallback.

### Production-preview browser evidence

Use fixed local fixtures and no live provider. Cover:

1. scheduled and active Market exact/relative times;
2. a retained item with older Value observed and newer Last evaluated;
3. a manual override update;
4. shared plus local snapshot selector/baseline/trend points;
5. expanded Loot Price history latest/baseline capture;
6. minute-boundary relative update without live announcement or storage change;
7. a date-only imported PriceSet with no invented time; and
8. an unrecognized compatible createdAt with safe `Date unavailable` copy.

Run browser projects with fixed `timezoneId: "UTC"`. Pure/component tests own
the Helsinki/DST and other zone evidence.

Exercise 1440 x 1000, 640 x 360, 390 x 844, 620 x 844 and 768 x 1024
containment. Inspect actual and diff images before updating only Economy,
Settings or expanded-Loot baselines genuinely changed by this presentation.

## Validation commands

Implementation validation must include, using the actual focused formatter test
filename chosen by the implementation:

```bash
npm run typecheck
npm run architecture:check
npm run test -- src/tests/price-data-view-model.test.ts src/tests/economy-settings-pane.test.ts src/tests/loot-view-model.test.ts src/tests/data-economy.test.ts src/tests/market-ui-state.test.ts
npm run test:e2e -- --workers=1 --grep "price history|Market|manual price|Loot.*history"
npm run test:golden
npm run test
npm run build
npm run test:e2e -- --workers=1
git diff --check
```

Run the repository's read-only visual comparison with the fixed clock/time zone
and inspect owned diffs before an explicit scoped baseline update. Use the
current commands from [testing.md](testing.md).

Goldens are required only as a no-calculation-regression gate; date formatting
must not change a numeric fixture or accepted warning classification.

## Acceptance criteria

This specification is implemented only when all of the following are true:

- no ordinary Market/manual/provenance/history/trend/Loot date surface exposes
  raw ISO or a sliced `YYYY-MM-DD` value;
- every recognized source time uses semantic `<time dateTime>` markup;
- instant values show English human-readable local date/time with explicit zone
  and retain exact UTC title/accessibility;
- date-only values remain date-only and never receive an invented clock time;
- relative past/future copy follows one tested signed contract;
- missing, non-applicable and invalid states are truthful and bounded;
- snapshot capture, item observation, refresh evaluation and manual update
  labels remain visibly distinct;
- retained prices can visibly show old observation and newer evaluation without
  appearing newly observed;
- canonical timestamps continue to own identities, sort, freshness,
  persistence and transfers;
- the minute clock changes only lightweight presentation and creates no live-
  region, calculation or persistence work;
- functional/visual browser time zone and fixture time are deterministic;
- desktop, compact landscape and mobile/tablet layouts remain contained;
- all PriceSet/history/manual/schema/formula/provider/backend boundaries remain
  unchanged; and
- focused, full functional, golden, architecture, build, browser, visual-review
  and diff gates pass.

## Documentation closure

Closure was recorded on 2026-07-20: this specification is implemented,
Market/Economy remain `Valmis`, the backlog card is `Done`, the local-history
lifecycle deferral now points to the shared implementation, and testing plus
architecture name the new pure formatter/component owners. D-085 timestamp
meaning remains unchanged in the provenance specification.

## Implementation evidence

Implemented on 2026-07-20 without changing a timestamp schema, source value,
history identity/order, freshness threshold, numeric calculation, provider or
backend boundary.

- `src/app/view-models/price-time.ts` owns strict explicit-offset instant and
  exact-date recognition, fixed `en-GB` presentation, IANA-zone validation with
  UTC fallback, signed past/future copy and deterministic seconds/ordinal
  collision handling.
- `src/app/components/price-time.tsx` owns canonical semantic `<time>` markup
  and a one-announcement exact/relative fact pair. Missing and invalid values
  remain ordinary bounded text.
- `price-data.ts` assigns source-accurate time labels and prepares Market,
  Settings, manual, provenance, selector, summary, lifecycle, mover and trend
  presentations. `loot.ts` consumes prepared latest/baseline capture facts.
- `App.tsx` resolves the browser zone once per session. Its existing minute
  clock rebuilds relative PriceSet/manual/provenance/summary presentation, while
  the shared/local merge, mover sort/filter and trend analysis memo excludes
  the clock dependency.
- both Playwright projects fix `timezoneId: "UTC"`; pure tests own
  Europe/Helsinki EET/EEST and invalid-zone behavior.
- focused formatter, component, price-data, chart, Loot, lifecycle and economy
  regression coverage passes 145/145. The combined release regression passes
  1,040/1,040 units and 19/19 goldens. Typecheck, zero-warning lint, format and
  diff checks pass. The architecture gate reports 161 source modules, zero
  cycles and 146 client-reachable modules.
- production build and artifact verification pass at 776,137 raw / 228,359
  gzip entry bytes, 23 files and 16 JavaScript chunks without raising D-098.
- the escalated production-preview Chromium gate passes 115/115, including the
  fixed-clock semantic/date-only/invalid/manual time transaction. The first
  real browser run exposed two test assertions that incorrectly treated the
  `T` in `UTC` as a raw-ISO signal; they now reject the ISO date-time structure
  instead.
- all 37 Darwin candidates were generated in an ignored review directory. The
  owned Loot, Economy and Settings date/time changes, the complete Planner
  notice surface and current fixture values were inspected before an explicit
  10-PNG scoped update. Two following complete read-only visual runs pass
  26/26 and 26/26.

This evidence is the final verification shared with the other five
release-readiness implementations.

## Open questions

None. English `en-GB` copy, browser-local time zone with UTC fallback,
instant/date-only precision, signed relative rules, semantic labels, `<time>`
markup, deterministic test zone and unchanged data contracts are decided here.

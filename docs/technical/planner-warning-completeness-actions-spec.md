# Planner warning completeness and actions specification

- Status: implemented
- Date: 2026-07-20
- Owner: technical documentation
- Evidence: verified
- Contract: closed

Priority: high.

Estimated effort: M.

Implementation evidence: Planner now retains structured warning identity from
the start, displayed result and training stance evaluations, and presents every
distinct row through one serializable issue/note model. The panel adds the
existing truncation fact as an actionable issue, uses the exhaustive current
producer registry plus a bounded unknown fallback and keeps deterministic
occurrence counts and ids across the Worker boundary. The native disclosure is
keyed by warning-set identity, labels retained output as previous and routes to
current Planner, gear, Loadout, Economy or Trip controls without automatic
edit, persistence, Undo or Recompute.

Focused domain, view-model, Worker, controller and component coverage passes
68/68; the complete unit suite passes 988/988 and goldens 19/19. Two focused
production-preview Chromium transactions pass: one covers a 25-row,
three-category truncated plan, keyboard disclosure, exact Target/Trip/Economy
focus, retained scope, unchanged storage/Undo and all five required viewports;
the other retains the same closed warning set through a failed refresh and
Retry. Typecheck, the 156-module zero-cycle architecture gate, production
build and diff checks pass. The final combined release run passes 115/115
functional Chromium cases. The expanded Planner-mobile candidate was reviewed
with all six issues and three notes, technical disclosures and correction
actions contained; its one owned baseline was updated explicitly, followed by
two complete 26/26 read-only Darwin runs.

## Purpose

Make every distinct warning that qualifies the retained Planner result visible,
understandable and connected to the closest existing review or correction
surface.

The current Planner already calculates structured `SimulationWarning` objects,
but its panel view model reduces them to message strings and the pane renders
only the first four. This specification closes that presentation gap without
changing Planner scoring, formulas, state, persistence or the explicit
`Recompute plan` boundary.

## Feature-inventory check

- Planner is `Valmis` in
  [the feature inventory](../product/feature-inventory.md). Its targets,
  calculation lifecycle, retained-result behavior, summary, training order,
  unlocks, chart, timeline and advanced gear pool are implemented.
- Economy already owns complete current-result price notes and contextual
  manual-price correction. This work reuses that warning taxonomy and
  correction destination; it does not add another price-data owner.
- Trip, Loadout and the Planner controls already own the assumptions to which
  the non-price warning families refer.
- This work hardens an accepted Planner workflow. Planner remains `Valmis`
  during and after implementation.
- Quest-state requirements, removal of D-051 requirement fallbacks, new source
  data, exact legacy numeric parity and new calculation features remain outside
  this contract.

## Verified current behavior and gap

The following statements are verified against the production rewrite on
2026-07-20:

- `SimulationWarning` already carries `code`, `message`, `severity`, optional
  `itemId` and optional structured `priceContext`.
- `PlannerPlan.warnings` contains Planner-native warnings plus deduplicated
  warnings from the start evaluation and each displayed step evaluation.
- `collectEvaluationWarnings` does not currently inspect
  `PlannerStep.trainingCfg`, even though that evaluation selects the stance
  used by the step.
- `createPlannerPanelViewModel` currently maps each structured warning to only
  `warning.message`; code, severity, item identity and price context are lost at
  the Worker response boundary.
- `planner-pane.tsx` renders `model.panel.warnings.slice(0, 4)`. It provides no
  overflow count, disclosure, severity distinction, warning scope or review
  action.
- `PlannerPlan.truncated` is shown only as `Truncated Yes/No` in the summary.
  The user is not told which existing controls can reduce the target range.
- the calculation controller intentionally retains the last successful panel
  while a refresh is stale, building or failed. Its `displayIsCurrent` value is
  the existing authority for whether that panel belongs to current inputs.
- the Planner panel view model is built inside `executeCalculationTask` and is
  structured-cloned from the calculation Worker. It therefore may contain only
  pure serializable data, never callbacks, elements or refs.
- the implemented result-first hierarchy places Planner warnings after the
  chart/timeline group and before the collapsed advanced gear pool.

The release-readiness problem is therefore not missing core Planner output. It
is lossy presentation: a plan can carry more than four distinct qualifications,
the retained warning set can be mistaken for a current result and the user
cannot move directly to the existing owner of a fix or mitigating assumption.

## Goals

- Preserve the structured identity and severity of every distinct Planner
  warning through the Worker response.
- Include warning-producing `trainingCfg` evaluations as well as the start and
  displayed-step evaluations.
- Expose the existing `truncated` result as an actionable presentation notice.
- Show counts and every distinct notice without an arbitrary visible-row cap or
  passive `N more` substitute.
- Use source-backed item names as primary copy and keep technical ids secondary.
- Distinguish issues from informational notes and current output from a retained
  previous plan.
- Give every notice one deterministic action that reaches the nearest existing
  owner and moves focus to a useful target.
- Keep navigation, focus, stale checks and fallback feedback safe when the live
  inputs have changed since the displayed plan was computed.
- Preserve native keyboard behavior, bounded mobile layout and calm live-region
  announcements.

## Non-goals

- No change to Planner scoring, candidate selection, metric calculation, XP,
  DPS, GP, trip, unlock, stance or truncation formulas.
- No change to the default `maxLevels: 120` policy in the rewrite adapter.
- No automatic Recompute, target edit, gear edit, price edit, loadout edit or
  Trip edit from a notice action.
- No new warning acknowledgement, dismissal, snooze, mute or persisted-read
  state.
- No change to `PlannerUiState`, `PLANNER_UI_VERSION = 1`, setup state,
  PriceSet, manual-price, history or Workspace schemas.
- No new global warning center, notification stack, modal, drawer or route.
- No duplicate complete price-note implementation in Planner and no message
  parsing to reconstruct missing item ids.
- No change to calculation-controller task identity, cancellation,
  latest-request-wins, Retry, fixed failure copy or retained-output policy.
- No provider call, automatic market refresh, API, backend, database, auth,
  deployment or generated-data change.
- No change to archived `planner.jsx`, `planner-core.js` or legacy runtime files.

## Terminology and severity

The domain type remains `SimulationWarning`. User-facing Planner copy calls the
collection `Plan notices`, because it can contain both issues and informational
notes.

- `error` and `warning` severities are **issues**.
- `info` severity is a **note**.
- one **distinct notice** is one deduplicated warning identity described below;
  repeated occurrences of the same identity do not inflate the visible notice
  count;
- an **occurrence** says where that identity was encountered: Planner setup,
  start evaluation, displayed-step result or training-stance evaluation; and
- a **previous plan** is any retained panel for which the existing
  `PlannerCalculationPresentation.displayIsCurrent` is false.

No current Planner producer emits `error`, but the presentation must support it
without a schema or component change.

## Complete warning inventory

The implementation must use an explicit code registry. Known codes must never
be classified by searching their English message.

| Code or family                                                                                                                                                         | Category     | User-facing title                             | Required action                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| synthetic `planner-truncated`                                                                                                                                          | Plan limit   | `Plan stopped at its level limit`             | `Review targets`                                                         |
| `manual-planner-requirement-fallback`                                                                                                                                  | Gear data    | `Requirement source is incomplete`            | `Review gear`                                                            |
| `missing-planner-weapon`                                                                                                                                               | Gear data    | `Planner weapon is unavailable`               | `Review gear`                                                            |
| `missing-planner-equipment`                                                                                                                                            | Gear data    | `Planner equipment is unavailable`            | `Review gear`                                                            |
| `hypothetical-planner-equipment`                                                                                                                                       | Gear data    | `Planner equipment needs review`              | `Review gear`                                                            |
| `dragon-halberd-npc-size-fallback`                                                                                                                                     | Combat model | `Dragon halberd size behavior is approximate` | `Review loadout`                                                         |
| `missing-price`, `missing-alch-value`, `price-fallback-used`                                                                                                           | Price issue  | existing friendly price-issue title           | `Correct price` when the item is editable; otherwise `Review price data` |
| `price-generated-fallback`, `price-market-retained`, `price-freshness-unknown`, `price-alias-used`, `approximate-data-source`, `unidentified-herb-price-approximation` | Price note   | existing friendly price-note title            | `Review price data`                                                      |
| `incoming-attack-partial-model`, `incoming-attack-compatibility-fallback`                                                                                              | Trip model   | `Incoming damage uses a compatibility model`  | `Review Trip assumptions`                                                |
| any unknown future code                                                                                                                                                | Other        | `Planner notice`                              | `Review Planner inputs`                                                  |

`missing-alch-value` is included because it is part of the shared money-warning
contract even if the current Planner path does not produce it. Risk-only warning
codes are not added speculatively; if a future Planner calculation emits one,
the safe unknown-code row remains complete and actionable until the registry is
intentionally extended.

The known-code registry must be exhaustive against current Planner, combat and
Trip producers in automated coverage. Adding a new producer code that can
reach `PlannerPlan` must fail the registry-exhaustiveness test until its
category, copy and action are chosen.

## Producer metadata amendments

The existing shared warning schema is sufficient. Make only these bounded
producer changes:

1. `fallbackRequirementWarning(itemId)` includes that `itemId` on the returned
   warning.
2. the plan-wide manual-requirement fallback warning is emitted once per
   affected item with `itemId`, rather than aggregating up to five technical ids
   into one message plus `N more`;
3. missing Planner weapon, missing Planner equipment and hypothetical Planner
   equipment warnings include their existing loop item as `itemId`; and
4. `collectEvaluationWarnings` inspects, in order, the start evaluation, each
   step's displayed `cfg` and that step's `trainingCfg`.

These changes make already-known facts addressable. They do not add a source,
change eligibility or alter a calculated value.

The plan-level collector must deduplicate with a stable structured identity:

```text
code
+ severity
+ itemId, when present; otherwise normalized bounded message
+ priceContext.consumer, when present
+ priceContext.lootRowId, when present
```

`priceContext.affectsCurrentResult` is merged with logical OR for repeated
occurrences; it is not a separate identity. Messages are normalized to one-line
whitespace and bounded to 240 characters before they cross the Worker response.
No raw error, stack, source path, request dump or provider payload may enter a
notice.

## Truncation presentation

When `plan.truncated` is true, the panel presenter prepends one synthetic
`planner-truncated` issue. It is presentation of an existing `PlannerPlan`
fact, not a new domain warning and not a new truncation condition.

Required copy:

- title: `Plan stopped at its level limit`;
- detail: `The displayed plan reached its calculation limit before every target was completed. Reduce or lock targets, then recompute.`; and
- action: `Review targets`.

The summary's existing `Truncated Yes/No` field may remain for compact numeric
inspection. The notice supplies explanation and the correction route. It must
not claim that lowering a particular skill is required, automatically alter a
target or automatically recompute.

## Structured panel view model

Replace `PlannerPanelViewModel.warnings: string[]` with a serializable
presentation owned by the Planner view-model layer. The exact naming may follow
repository conventions, but it must represent at least this contract:

```ts
type PlannerNoticeCategory =
  "plan-limit" | "gear-data" | "price-data" | "combat-model" | "trip-model" | "other";

type PlannerNoticeAction =
  | { kind: "review-targets"; label: "Review targets" }
  | { kind: "review-gear"; label: "Review gear"; itemId?: EntityId }
  | { kind: "review-loadout"; label: "Review loadout" }
  | { kind: "correct-price"; label: "Correct price"; itemId: EntityId }
  | { kind: "review-price-data"; label: "Review price data"; itemId?: EntityId }
  | { kind: "review-trip"; label: "Review Trip assumptions" }
  | { kind: "review-planner-inputs"; label: "Review Planner inputs" };

interface PlannerNoticeOccurrenceSummary {
  totalCount: number;
  visibleLabels: string[];
  hiddenCount: number;
}

interface PlannerNoticeViewModel {
  id: string;
  code: string;
  severity: "info" | "warning" | "error";
  category: PlannerNoticeCategory;
  title: string;
  detail: string;
  itemDisplayLabel?: EntityDisplayLabel;
  occurrences: PlannerNoticeOccurrenceSummary;
  action: PlannerNoticeAction;
}

interface PlannerNoticePresentation {
  warningSetId: string;
  issueCount: number;
  noteCount: number;
  occurrenceCount: number;
  rows: PlannerNoticeViewModel[];
}
```

`EntityDisplayLabel` follows the existing language contract: source-backed game
name first, technical id only as secondary technical detail. When an `itemId`
has no current source-backed name, its bounded technical id is the fallback
name and the row must not invent a friendlier identity.

`PlannerNoticeAction` is data only. It is safe to structured-clone and carries
no mutation callback. The Worker-side presenter may receive the current
`GameDataSnapshot` needed for labels; this does not move navigation into the
Worker or add data to `PlannerPlan`.

The existing `CalculationWarningViewModel` normalization and money-code
taxonomy should be extracted or reused rather than independently copied. The
current Result/Loot/Economy price-note behavior and wording must remain
unchanged while shared pure helpers become reusable by Planner.

## Occurrence and deduplication contract

The presenter builds one exhaustive warning index from:

1. the plan's own warnings;
2. `plan.start.warnings`;
3. every `step.cfg.warnings`; and
4. every `step.trainingCfg.warnings`.

The first list preserves Planner-native warnings. The evaluation scan attaches
context and defensively includes a structured warning even if a collector
regression omitted it from `plan.warnings`.

Occurrence labels are fixed and user-facing:

- `Planner setup` for a Planner-native warning with no evaluation occurrence;
- `Plan start` for `plan.start`;
- `<Skill> <from>–<to> result` for `step.cfg`; and
- `<Skill> <from>–<to> training stance` for `step.trainingCfg`.

One row shows at most the first three occurrence labels plus an explicit
`N more occurrences` count. This bound applies only to repeated locations of
the same distinct warning. It must never hide a distinct notice row.

Rows are sorted deterministically:

1. `error`;
2. `warning`;
3. `info`;
4. first producer occurrence order within the same severity; and
5. stable id as the final tie-breaker.

`issueCount` and `noteCount` count distinct rows. `occurrenceCount` counts all
recorded occurrences and may be greater than their sum. The synthetic
truncation row counts as one issue and one occurrence.

`warningSetId` is a deterministic bounded hash or joined identity derived from
the ordered distinct row identities and truncation state. It contains no user
data beyond those bounded identities and no timestamp or random value. The
same retained panel keeps the same id through stale, building and failed
states.

## User-facing presentation

Keep the notice surface in the existing result-first semantic position:

1. summary;
2. training order;
3. unlock summary;
4. chart and gear timeline;
5. `Plan notices`; and
6. `Advanced gear pool` after the complete output.

Do not move notices above the result lifecycle message or between summary and
the primary training result.

When rows exist, render one native `details` element. Its visible summary is:

```text
Plan notices · X issues · Y notes
```

Use singular grammar for one issue or note. Zero values remain visible so the
two severities are unambiguous. When the panel is retained and
`displayIsCurrent` is false, use:

```text
Previous plan notices · X issues · Y notes
```

The disclosure rules are:

- initially open for a newly settled warning set containing at least one issue;
- initially closed for a newly settled information-only set;
- keyed by `warningSetId`, so a genuinely new result receives the appropriate
  initial state while stale/building/failed retention does not reset the user's
  current disclosure choice;
- transient and never persisted;
- user-controllable with native pointer, Enter and Space behavior;
- no `.slice`, pagination or hidden distinct-row count; and
- absent when there are no rows and the plan is not truncated.

Inside the disclosure, use one semantic list. Each row shows, in order:

1. severity word (`Issue` or `Note`) and fixed title;
2. friendly detail;
3. source-backed item label and secondary technical id, when applicable;
4. occurrence summary; and
5. exactly one action button.

Known-code rows use the fixed user-facing copy registry and never display raw
technical messages as their primary detail. Unknown-code rows display the
normalized bounded producer message as secondary detail under the fixed
`Planner notice` title. Code values may appear only in an optional technical
detail, not in the main title or action label.

## Action routing and focus

An action is navigation to an existing owner. Navigation alone must not mutate
state, persist data, replace global Undo or trigger Recompute.

### Review targets

- stay on Planner;
- focus the `Planner skill targets` group or its first enabled target field;
- scroll only the Planner pane's existing scroll owner as needed; and
- leave every target unchanged.

### Review gear

- stay on Planner;
- explicitly open the existing transient `Advanced gear pool` disclosure;
- if the notice's `itemId` exists among the current options, focus that exact
  checkbox;
- otherwise focus the disclosure summary and show fixed polite copy:
  `That item is not available in the current Planner gear pool.`; and
- do not reinsert a filtered, missing or hypothetical candidate.

This is the only amendment to the implemented advanced-disclosure contract:
the disclosure may be opened by the user's explicit `Review gear` action. It
must still not auto-open on calculation, stale, building, failure, Retry,
Recompute, reload or an unrelated result settlement.

### Review loadout

- activate the existing Loadout tab for the current combat style;
- focus its primary weapon selector, because the current combat-model notice is
  caused by the selected dragon-halberd path; and
- do not change style, weapon or special-attack state.

### Correct price

- use the existing item-id-based manual-price correction route;
- activate Economy, select the exact editable item and focus `Manual price`;
- initialize the draft through the current active/base-price behavior; and
- require the existing explicit `Apply price` action before any price or
  persistence change.

If the item ceased to be editable after the displayed plan was computed, fall
back to `Review price data` and show fixed neutral copy. Do not submit a zero or
parse the warning message.

### Review price data

- activate Economy;
- set the existing trend/selected-item control only when the item is still a
  valid option;
- focus the `Market` heading or the exact selected-item provenance surface when
  that stable target exists; and
- otherwise focus `Market` and show fixed neutral copy that the earlier item is
  no longer available.

Planner does not create a duplicate Economy notice or assume that a candidate-
evaluation warning is present in the current Result's price-note list.

### Review Trip assumptions

- activate Trip;
- focus the existing `Food per kill override` control group, the current manual
  mitigation for incomplete incoming-damage source coverage; and
- leave protect prayer, safespot and override values unchanged.

The row must explain that the underlying source model remains approximate;
using an override is optional and does not repair the source data.

### Review Planner inputs

- stay on Planner;
- focus the `Planner controls` group or first enabled control; and
- show no promise that an unknown future warning can be corrected there.

## Action freshness and fallback

The displayed row belongs to the displayed panel, but the action resolves
against current UI options when clicked. This is required because the retained
panel may be previous output.

- use stable `itemId` and action kind, never array position or English copy;
- make each focus request one-shot and latest-request-wins;
- cancel a pending request when a newer notice action replaces it;
- after tab/disclosure activation, focus in the next animation frame only when
  the expected current target exists;
- use `preventScroll: true`, then scroll the owning pane to `nearest` only when
  the focused target is outside the viewport;
- if the exact target disappeared, focus the documented safe parent and expose
  fixed neutral feedback;
- do not throw, leave focus in a hidden pane or focus a stale detached element;
  and
- do not change `displayIsCurrent` or make a previous panel current by merely
  reviewing it.

Same-pane refs belong in `PlannerPane`; cross-tab request state and routing stay
in the App composition root or a focused controller extracted under its
existing ownership rules. The Worker and Planner domain never own refs.

## Retained-result and calculation lifecycle

The existing controller remains authoritative:

| Planner state                     | Notice heading          | Action behavior                                                  |
| --------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `ready`, current panel            | `Plan notices`          | resolve against current controls                                 |
| `stale`, retained panel           | `Previous plan notices` | resolve against current controls without implying current output |
| `building`, retained panel        | `Previous plan notices` | remain usable; no second calculation starts                      |
| `failed`, retained panel          | `Previous plan notices` | remain usable beside existing fixed Retry lifecycle              |
| first build/failure without panel | no notice surface       | existing lifecycle copy remains the only result-position content |
| `idle` without panel              | no notice surface       | existing bundled-data availability copy remains truthful         |

The visible lifecycle message stays immediately before the retained output.
The notice disclosure must not duplicate Retry, expose failure detail or replace
the current/previous result label.

## Accessibility and announcements

- Native `details`/`summary` supplies the disclosure state and keyboard
  interaction.
- The summary is the only focus stop while the disclosure is closed.
- Open rows follow semantic list order; every action has a unique accessible
  name including its row title or item label when repeated labels would
  otherwise be ambiguous.
- Severity is conveyed in text as well as color.
- Focus-visible styling must remain visible without layout shift.
- The list itself is not a live region. Do not announce every row on settlement.
- One separate polite status summary may announce a newly settled warning set:
  `Planner found X issues and Y notes.` It is keyed to `warningSetId` and must
  not repeat when the same panel becomes stale, building, failed or visible
  again after tab navigation.
- The existing calculation lifecycle live region remains independent. A
  settlement must not cause duplicate full-panel announcements.
- Friendly item name, technical id and occurrence text must remain readable at
  200% zoom and in forced-colors mode.
- The existing chart image label, headings and table accessible names remain
  unchanged.

## Responsive and visual contract

At the current 1440 x 1000 desktop viewport:

- the center pane remains the only workbench vertical scroll owner;
- the notice disclosure stays visually subordinate to summary/training output;
- open rows use available width without pushing or overlapping the MonsterCard
  rail; and
- action buttons do not create a second horizontal scroll owner.

At 640 x 360 compact landscape and at 390 x 844, 620 x 844 and 768 x 1024
normal-flow layouts:

- summary, severity, copy, item label, occurrence text and action wrap within
  the viewport;
- there is no document-level horizontal overflow;
- the disclosure summary remains one reachable native focus stop when closed;
- opening a long complete list may extend the existing vertical scroll content
  but must not trap focus or hide the mobile tab/navigation controls; and
- focusing a cross-tab destination scrolls only the destination's owning
  content to the nearest useful position.

Visual changes are owned by Planner. Existing Result, Loot, Economy and Trip
baselines must not be rewritten unless their rendered output genuinely changes
because of a shared presentation-helper extraction or new stable focus target.

## Persistence, Undo and privacy

- Disclosure open state, action requests and neutral fallback notices are
  session-only presentation state.
- Notice actions that only navigate do not write browser storage and do not
  replace `pendingUndo`.
- A later explicit gear, target, loadout, Trip or manual-price mutation follows
  that owner's current persistence, recovery, stale and Undo contract.
- Blocked/unavailable local storage does not prevent reviewing a notice.
- Do not include raw storage values, imported payloads, provider responses,
  Worker exceptions, stack traces, filesystem paths or internal request objects
  in ids, copy or accessible names.
- Technical item ids are allowed only because they are already bounded domain
  identifiers and are shown as secondary diagnostic identity.

## Architecture and ownership

- `src/domain/planner/index.ts` owns complete warning collection and structured
  item metadata already known while building the plan.
- `src/domain/shared/index.ts` keeps the unchanged `SimulationWarning` schema.
- a shared pure warning-presentation helper under `src/app/view-models` owns
  message normalization and the money-warning registry used by both current
  price notices and Planner.
- `src/app/view-models/planner.ts` owns Planner categories, friendly copy,
  occurrence indexing, deterministic ids/counts and action intents.
- `src/app/calculation-task.ts` continues to build the serializable Planner
  panel inside the Worker boundary and supplies source-backed game data needed
  only for display labels.
- `src/app/controllers/use-planner-calculation.ts` remains the sole owner of
  current versus retained-panel truth and task lifecycle.
- `src/app/components/panes/planner-pane.tsx` owns the disclosure markup,
  same-pane target refs and same-pane focus behavior.
- `src/app/App.tsx` or a focused existing-boundary controller owns cross-tab
  routing and one-shot focus requests.
- Economy, Loadout and Trip retain ownership of their current controls and
  mutations.
- `src/app/styles.css` owns bounded Planner notice styling.

No new layer exception or dependency from domain to app is allowed. Run the
architecture check because the calculation-task/view-model boundary changes.

## Implementation slices

### Slice 1: complete structured source

1. add `itemId` to the four Planner-native producer paths;
2. replace aggregate manual fallback copy with one structured item warning per
   item;
3. include `trainingCfg` in plan warning collection;
4. align structured deduplication and OR-merge price relevance; and
5. add domain tests proving start/display/training/native coverage.

### Slice 2: serializable notice presentation

1. extract or reuse shared warning normalization and money-code classification;
2. define the closed Planner notice code registry and safe unknown fallback;
3. index occurrences and create deterministic row/set ids;
4. resolve source-backed item display labels;
5. synthesize the truncation issue; and
6. return counts, rows and action intents through the Worker result.

### Slice 3: complete pane surface

1. replace the four-string block with the native keyed disclosure;
2. render issue/note text, fixed copy, item identity, occurrence summary and
   one action per row;
3. derive `Plan` versus `Previous plan` from the existing presentation model;
4. add the bounded settlement announcement; and
5. retain the implemented result-first order.

### Slice 4: action and focus bridges

1. implement Planner-local target and gear focus;
2. add explicit user-triggered opening of the advanced gear disclosure;
3. reuse manual-price item correction;
4. add stable Market, Loadout weapon and Trip override review targets;
5. implement stale-target fallbacks and latest-request-wins cancellation; and
6. prove navigation-only actions do not mutate, persist, recompute or replace
   Undo.

### Slice 5: responsive, visual and documentation closure

1. add contained responsive styles and forced-color treatment;
2. run focused unit/component/Worker/browser coverage;
3. review Planner desktop, compact landscape and mobile/tablet images;
4. run complete functional, golden, architecture and diff gates; and
5. promote implementation evidence to the living docs without changing
   Planner's `Valmis` status.

## Expected implementation files

Likely source owners:

- `src/domain/planner/index.ts`
- `src/app/view-models/contracts.ts` or one focused shared warning helper
- `src/app/view-models/price-data.ts`
- `src/app/view-models/planner.ts`
- `src/app/calculation-task.ts`
- `src/app/controllers/use-planner-calculation.ts` only if the panel contract
  needs typed exposure; its lifecycle must not change
- `src/app/components/panes/planner-pane.tsx`
- `src/app/components/panes/trip-pane.tsx` only for a stable review ref
- `src/app/App.tsx` or a focused in-boundary navigation controller
- `src/app/styles.css`

Likely evidence owners:

- `src/tests/planner-domain.test.ts`
- `src/tests/simulation-view-model.test.ts`
- `src/tests/calculation-task.test.ts`
- `src/tests/planner-controller.test.ts`
- `src/tests/planner-pane.test.ts`
- `src/tests/price-data-view-model.test.ts`
- `src/tests/app-shell-components.test.tsx` if cross-tab routing remains in App
- focused Planner production-preview and visual scenarios

The exact helper filename is intentionally not prescribed. The required owner
boundary and no-duplication rule are prescribed.

## Required automated evidence

### Domain and view-model tests

Prove at minimum:

- manual fallback, missing weapon/equipment and hypothetical equipment warnings
  expose their exact `itemId`;
- one item receives one stable identity even when it occurs at start and in
  multiple steps;
- a warning present only in `trainingCfg` reaches `PlannerPlan.warnings` and the
  panel row inventory;
- price consumer/loot-row identities remain distinct where their structured
  contexts differ;
- `affectsCurrentResult` OR-merges repeated identities;
- more than four distinct warnings all appear in `rows`;
- repeated occurrences produce first-three labels plus an exact hidden count,
  without hiding a distinct row;
- error/warning/info ordering, counts and deterministic ids;
- `truncated` produces exactly one action row and false does not;
- every current reachable producer code has an explicit registry entry;
- an unknown bounded warning receives the safe Other row and action;
- source-backed names are primary and unknown item ids remain bounded;
- messages over 240 characters and multiline whitespace are normalized; and
- the panel result remains structured-cloneable.

### Controller and component tests

Prove at minimum:

- no disclosure for an empty, non-truncated notice set;
- info-only is initially closed and an issue set initially open;
- a new `warningSetId` resets only the disclosure's initial state;
- the same retained set stays user-controlled through stale/building/failed;
- current and previous headings follow `displayIsCurrent` exactly;
- every distinct row renders; no `.slice(0, 4)` or passive overflow remains;
- severity is textual and each repeated action has an unambiguous accessible
  name;
- native summary keyboard behavior and closed descendant focus exclusion;
- `Review targets` focuses the target group without mutation;
- `Review gear` opens the existing disclosure and focuses the exact current
  checkbox or the safe summary fallback;
- `Review loadout`, `Correct price`, `Review price data` and `Review Trip
assumptions` activate and focus their exact owner;
- stale/missing item and superseded focus requests use the documented fallback;
- navigation-only actions do not call Recompute, persistence or Undo setters;
- the settlement summary announces once per new set and does not repeat on
  retained lifecycle changes; and
- fixed failure privacy and Retry behavior remain unchanged.

### Production-preview browser evidence

Use deterministic local fixtures or test-only calculation inputs. Do not call a
live market or Hiscores provider.

Cover one transaction that:

1. settles a current plan with at least five distinct notices across at least
   three categories;
2. confirms every row and issue/note count;
3. closes/reopens the native disclosure with keyboard;
4. routes a gear notice to the exact option;
5. routes a price issue to the exact manual-price item without applying it;
6. returns, makes Planner inputs stale and proves `Previous plan notices`;
7. routes a Trip-model notice to its current override control;
8. fails or retries a refresh while retaining the same notice-set id and user
   disclosure choice; and
9. verifies that no action alone changed Planner/form/price storage or global
   Undo.

Add a separate truncated fixture if the main transaction cannot reach the
existing 120-level limit without brittle data changes. Prove target focus and
no automatic edit/Recompute.

Exercise 1440 x 1000, 640 x 360, 390 x 844, 620 x 844 and 768 x 1024 for
containment. Review actual and diff images before updating only genuinely owned
Planner baselines.

## Validation commands

Implementation validation must include, adjusting exact test filenames only if
an owner is deliberately extracted:

```bash
npm run typecheck
npm run architecture:check
npm run test -- src/tests/planner-domain.test.ts src/tests/simulation-view-model.test.ts src/tests/calculation-task.test.ts src/tests/planner-controller.test.ts src/tests/planner-pane.test.ts src/tests/price-data-view-model.test.ts src/tests/app-shell-components.test.tsx
npm run test:e2e -- --workers=1 --grep "Planner notices|Planner warning|calculation lifecycle"
npm run test:golden
npm run test
npm run build
npm run test:e2e -- --workers=1
git diff --check
```

Run the repository's read-only visual comparison and inspect Planner-owned
desktop/mobile diffs. Use the current commands from
[testing.md](testing.md) at implementation time rather than inventing a second
visual workflow here.

Goldens are required even though formulas do not change: complete warning
collection now includes the stance evaluation that already contributes to a
Planner step, and the retained output still carries combat/trip/economy values.

## Acceptance criteria

This specification is implemented only when all of the following are true:

- every distinct current Planner warning survives as structured serializable
  presentation data;
- start, displayed-step and training-stance evaluation warnings are covered;
- no first-four cap or hidden distinct warning remains;
- truncation has a truthful Review-targets route;
- every row has deterministic friendly copy, severity text, item identity when
  known, occurrence context and one safe action;
- every current producer code is explicitly registered and unknown future codes
  fail safely;
- current versus previous notice scope follows the existing lifecycle truth;
- all action routes resolve against current controls, focus a useful destination
  or use fixed safe fallback copy;
- navigation alone performs no edit, persistence, Recompute or Undo mutation;
- advanced gear opens only from the user's explicit Review action, not from
  unrelated lifecycle events;
- announcements are bounded and do not repeat the full notice list;
- desktop, compact landscape and mobile/tablet layouts contain the complete
  list and focus path;
- Planner scoring, output values, state/persistence schemas, Worker lifecycle,
  provider and deployment boundaries remain unchanged; and
- focused, full functional, golden, architecture, build, browser, visual-review
  and diff checks pass.

## Documentation closure after implementation

- change this status from `proposed` to `implemented` and record concise test
  evidence;
- keep Planner `Valmis` in
  [the feature inventory](../product/feature-inventory.md) and amend its note to
  describe complete actionable notices;
- move the backlog entry from `Specced` to `Done` with measured evidence;
- keep the Planner result-first hierarchy specification as the order owner and
  record only the explicit Review-gear disclosure amendment there if needed;
- update [testing.md](testing.md) if exact authoritative test commands or visual
  owners change; and
- update architecture documentation only if implementation changes a module
  owner or dependency boundary beyond the contract above.

## Open questions

None. The implementation may choose helper filenames and local CSS class names,
but warning identity, completeness, copy/action registry, result scope, focus
fallbacks, non-mutation boundary and validation evidence are decided here.

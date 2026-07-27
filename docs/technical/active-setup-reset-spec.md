# Safe active setup reset specification

- Status: implemented
- Date: 2026-07-19
- Owner: setup UI and rewrite-owned browser state
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parent: `Basic combat setup` (`Valmis`)
- Active runtime context: canonical Revision 274 defaults
- Depends on: the implemented six-family setup capture/apply/Undo boundary and
  setup replacement test foundation

## Purpose

Add a review-gated `Reset active setup` action that returns the setup currently
being edited to the app's canonical defaults without requiring an earlier file
export.

The reset must be safe for experimentation: it preserves the current target and
all state outside the active setup owner, persists one complete validated
rewrite setup, and offers one complete persistence-aware Undo.

## Verified current behavior and problem

- Ordinary level, equipment, prayer, boost, manual combat override and Trip
  edits update the live form and are persisted automatically under
  `index-sim:rewrite-setup`.
- `SavedSetupState` contains six state families: `form`, `defaultForm`,
  `setupMode`, `customSetupsByMonster`, `denseCompare` and `cannonByMonster`.
- `App.tsx` already captures those six families, applies them through one
  helper and uses the same boundary for persistence-aware import and saved-row
  Undo.
- `DEFAULT_FORM_STATE`, `createDefaultPerStyleLoadouts()`,
  `switchCombatStyleLoadout()` and `normalizeFormState()` already own the
  canonical form and per-style loadout defaults used by the Revision 274 root
  runtime.
- The UI has Review/Apply/Undo for imported setup replacement, Undo for saved
  setup Load and loadout optimization, plus several narrow field- or
  modifier-specific Reset actions.
- There is no action or specification for returning the complete active setup
  to a known canonical starting point while keeping the current target and
  unrelated browser-local state.

After a long experiment, a user must therefore restore fields individually or
import a previously exported setup file.

## Feature-inventory boundary

`Basic combat setup` remains `Valmis`. This is a high-priority safety extension
to the existing workflow, not a missing V1 replacement feature.

The feature does not add a setup store, a reset history, another export format
or a general local-state wipe. Existing targeted Reset actions remain useful
for narrow corrections.

## Goals

- Put `Reset active setup` with the existing setup actions.
- Build a reset candidate from the canonical app defaults without mutation or
  persistence.
- Preserve the current target, selected combat style and setup mode.
- Reset global form inputs and all three per-style loadout caches so switching
  styles cannot revive values from the experiment.
- Show a grouped current-to-default review before confirmation.
- Persist and apply one complete validated `SavedSetupState` transaction.
- Offer one complete Undo that restores the prior six-family setup and browser
  persistence when available.
- Prove that target, collections, modifiers, prices and histories outside the
  active setup owner are unchanged.

## Non-goals

- Do not clear all local storage or reuse the local-state recovery `Clear`
  workflow.
- Do not change `SavedSetupSchema`, `REWRITE_SETUP_VERSION`, storage keys or
  persistence envelope versions.
- Do not reset the current target, selected combat style or setup mode.
- Do not delete saved Duel setups or unrelated monster-specific custom setups.
- Do not reset Dense preferences, Cannon settings, loot actions, loot settings,
  hidden gear tiers, Hiscores state, PriceSets, manual item-price overrides or
  shared/local price history.
- Do not directly reset Planner UI state outside `CombatSetupFormState`. The
  form-owned planner target levels are part of the active setup and do reset;
  the existing Planner integrity contract may separately reconcile XP or
  unlocked targets that become incompatible with reset levels.
- Do not change simulation formulas, generated data, `SimulationRequest`,
  share/setup transfer contracts or calculated-result schemas.
- Do not add multi-step history, persisted Undo, partial checkbox selection,
  accounts, cloud saves, telemetry or a backend.

## Style-cache decision

Keep the selected `combatStyle` as navigation context, but reset the cached
loadout for all three styles: `melee`, `ranged` and `magic`.

For example, resetting while Ranged is selected leaves Ranged selected. The
visible weapon, ammo, stance, equipment, prayers, boosts, special and manual
combat overrides become the canonical Ranged values, while the hidden Melee
and Magic caches also become their canonical values.

Resetting only the selected style is rejected for this feature. It would make a
later style switch unexpectedly restore part of the experiment and would not
meet the promise of resetting the whole active setup. The review must state
both facts separately:

- `<Style> remains selected`; and
- `Melee, Ranged and Magic cached loadouts reset`.

## Canonical reset candidate

### Single source of defaults

Do not copy Revision 274 defaults into a component, controller or second data
file. Build a fresh normalized form through the existing state owners:

```ts
function createCanonicalActiveForm(current: CombatSetupFormState): CombatSetupFormState {
  const styleDefaults = switchCombatStyleLoadout(DEFAULT_FORM_STATE, current.combatStyle);
  return normalizeFormState({
    ...styleDefaults,
    monsterId: current.monsterId
  });
}
```

Equivalent code is acceptable, but it must satisfy all of these invariants:

- `monsterId` equals the current form's target;
- `combatStyle` equals the current selected style;
- every global setup field comes from `DEFAULT_FORM_STATE`;
- every entry in `perStyleLoadouts` is a fresh canonical default;
- active top-level loadout fields equal the selected style's reset cache;
- the result passes `SavedSetupSchema` through the normal setup builder; and
- no mutable object or array from a shared default constant is exposed for
  later in-place modification.

The implementation targets the active runtime revision. Revision 274 is the
current context, but a future accepted revision bump must update the canonical
default owner rather than this reset workflow.

### Default and custom ownership

Build the final candidate from a complete current `SavedSetupState`.

When `setupMode === "default"`:

- set `form` and `defaultForm` to the canonical active form;
- keep `setupMode` as `default`;
- preserve `customSetupsByMonster` exactly, including a possible custom setup
  for the current target; and
- preserve `denseCompare` and `cannonByMonster`.

When `setupMode === "custom"`:

- set `form` to the canonical active form;
- replace only `customSetupsByMonster[currentTarget]` with that form through
  `setCustomSetupForMonster()`;
- preserve `defaultForm` and every other custom-setup entry;
- keep `setupMode` as `custom`; and
- preserve `denseCompare` and `cannonByMonster`.

Pass the assembled values through `savedSetupFromForm()` or
`SavedSetupSchema.parse()`. Do not construct an unchecked storage envelope.

### Candidate contract

An equivalent in-memory contract is:

```ts
interface ActiveSetupResetCandidate {
  id: number;
  source: SavedSetupState;
  setup: SavedSetupState;
  scope: {
    targetId: EntityId;
    combatStyle: CombatStyle;
    setupMode: SetupMode;
    owner: "default" | "current-target-custom";
    resetStyleCaches: readonly ["melee", "ranged", "magic"];
  };
  review: ActiveSetupResetReviewViewModel;
}
```

`source` and `setup` are session-only validated values. They are not added to
React persistence, transfer files, URLs or telemetry.

## Protected-state contract

| State area                                             | Confirmed reset behavior                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current target                                         | Preserved exactly.                                                                                                                                     |
| Selected combat style                                  | Preserved; its values reset with all three style caches.                                                                                               |
| Setup mode                                             | Preserved as Default or Custom.                                                                                                                        |
| Current default setup                                  | Replaced only when Default is active.                                                                                                                  |
| Current target's custom setup                          | Replaced only when Custom is active.                                                                                                                   |
| Other custom setups                                    | Preserved exactly.                                                                                                                                     |
| Saved Duel comparison collection                       | Preserved exactly; no setter or storage write.                                                                                                         |
| Dense filters, sort and irrelevant rows                | Preserved exactly.                                                                                                                                     |
| Per-monster Cannon state                               | Preserved exactly.                                                                                                                                     |
| Loot actions and loot settings                         | Preserved exactly.                                                                                                                                     |
| Hidden gear tiers and other view preferences           | Preserved exactly.                                                                                                                                     |
| Active/base PriceSet and selected PriceSet persistence | Preserved exactly.                                                                                                                                     |
| Manual item-price overrides                            | Preserved exactly.                                                                                                                                     |
| Shared and browser-local price history                 | Preserved exactly.                                                                                                                                     |
| Hiscores response and persisted last player            | Preserved exactly.                                                                                                                                     |
| Planner UI state outside the form                      | Not directly reset. Existing integrity reconciliation may persist only the XP/target adjustments required by changed levels; form-owned targets reset. |
| Calculated output                                      | Recomputes from the reset inputs; it is not persisted reset data.                                                                                      |

The Reset/Undo transaction directly writes only `index-sim:rewrite-setup`. It
must not call collection, loot, price, history, Hiscores or manual-price
persistence helpers. After changed levels apply, the existing Planner integrity
owner may write `index-sim:planner-ui` only when its documented reconciliation
requires an XP/target adjustment; that derived write is not reset candidate
state and must be disclosed through the existing Planner notice.

## Review and confirmation workflow

### Open review

1. Place a `Reset` button with accessible name and title
   `Reset active setup` in the existing `Setup actions` group beside New, Edit
   and Remove.
2. Activating it captures the current six-family setup and builds one canonical
   candidate in memory.
3. Candidate creation performs no setter call, persistence, recovery unblock
   or pending-Undo replacement.
4. If no resettable field differs, show `Active setup already matches the
defaults`, keep the prior pending Undo unchanged and do not show an enabled
   Confirm action.
5. Otherwise show an inline review near the setup context with
   `Reset active setup` and `Cancel` buttons.

Do not use `window.confirm()`. A review is normal valid state and must not use
`role="alert"`.

### Grouped change summary

The review starts with the preserved context:

- target display name;
- selected combat style and setup owner (`Default` or current-target `Custom`);
- the selected style remains selected;
- all three style caches reset; and
- saved setups, prices and histories are kept; and
- resetting levels may make Planner reconcile incompatible explicit XP or
  unlocked targets under its existing integrity contract.

Show only groups that contain changes, in this order:

1. `Player levels`;
2. `Loadouts and equipment`, with Melee/Ranged/Magic subgroups;
3. `Prayers and boosts`, with per-style differences;
4. `Special attacks and combat overrides`, with per-style differences;
5. `Trip and supplies`, including Ring of Wealth; and
6. `Planner targets`.

Each group exposes a changed-field count and human-readable current-to-default
rows. Resolve entity ids through current validated game-data labels or existing
selection labels. A missing display label may use a sanitized humanized id; raw
schema paths, storage keys, serialized objects and parser diagnostics are not
shown.

Normalize the current form before comparison and compare loadout-owned fields
through the three `perStyleLoadouts` entries. Do not count the selected cache a
second time through duplicate top-level form fields. The field set is fixed by
the current schema, so the review must remain bounded without arbitrary payload
truncation.

This reset-specific diff may share generic labels/formatters with the Duel diff,
but it must not reuse the Duel comparison scope unchanged: Duel intentionally
excludes inactive caches and Planner targets, while this review must include
both.

### Stale-review guard

Confirmation must consume the candidate once by id and only while the current
six-family setup still matches its captured `source` semantically.

If the target, form, default/custom owner, Dense state or Cannon state changes
while review is open, invalidate the candidate and show a fixed message such as
`Setup changed. Review the reset again.` A stale candidate must not persist,
apply or unblock state.

Changes to protected state outside the six-family setup, such as a PriceSet or
saved Duel collection update, do not alter the candidate and need not invalidate
the review because Confirm cannot write those areas.

## Confirm transaction

On `Reset active setup` confirmation:

1. consume the non-stale candidate once;
2. retain its complete captured `source` as the Undo value;
3. persist `candidate.setup` once through the existing rewrite-setup recovery
   path;
4. apply all six candidate families through `applyRewriteSetupState()`;
5. unblock only `rewrite-setup` and refresh local-state health;
6. clear the review and any reset-specific error;
7. announce a durable or truthful session-only result; and
8. register one pending Undo with the complete captured source.

Use the existing `persistAndApplyRewriteSetup()` boundary or an equivalent
shared transaction helper. `One transaction` means one validated
`SavedSetupState`, one direct rewrite-setup persistence call and one complete
live application; the UI must never expose a partially reset family set. The
normal persistence effect may later converge on the same semantic value, and
Planner may reconcile after changed levels, but neither may construct or expose
an intermediate rewrite setup.

Recommended copy:

- durable: `Reset active setup to defaults.`
- session-only: `Reset active setup for this session. Changes may not persist
after reload.`
- Undo restore: `Restored setup from before reset.`

If persistence fails, apply the complete candidate for the current session and
leave the global local-state attention surface responsible for durability. A
failure must not fall back to partial field setters.

Confirm replaces the app's previous single pending Undo only after a successful
complete in-memory application. Open, Cancel, stale confirmation and no-op
review leave the previous pending Undo unchanged.

## Undo contract

Undo uses the existing single pending action and performs this order:

1. persist the captured prior `SavedSetupState` through the rewrite-setup
   recovery path;
2. apply all six prior state families through the shared helper;
3. unblock and refresh only `rewrite-setup`;
4. clear the pending Undo; and
5. announce durable or session-only restoration truthfully.

Undo therefore restores the exact default/custom owner, all three style caches,
target, Dense state and Cannon state captured before Confirm. The saved Duel
collection, PriceSet and histories remain outside both Reset and Undo.
Planner UI state is not part of the six-family Undo value; restored levels run
through the same accepted Planner reconciliation contract instead of reviving
an XP value that was already normalized as incompatible.

Reload, tab close or another undoable action retains the existing one-step Undo
semantics; no Undo history is persisted.

## Architecture and likely implementation files

Keep candidate creation and diffing DOM-free. A focused app-state module is
preferred over adding the entire workflow directly to the composition root:

- `src/app/state/active-setup-reset.ts`: canonical candidate, ownership rules,
  semantic stale check and grouped diff model;
- a pure reset-review component under `src/app/components`;
- `src/app/components/shell/workbench-shell.tsx`: setup action and nearby review
  composition;
- `src/app/App.tsx`: current-state capture, Confirm persistence/application and
  Undo registration;
- `src/app/styles.css`: bounded desktop/mobile review layout;
- focused state and component tests; and
- `src/tests/e2e/loadout.spec.ts` for the visible setup transaction.

Do not move browser storage, local-state recovery or React setters into the
pure candidate module. Do not add reset fields to domain or transfer schemas.

## Accessibility and responsive behavior

- The action is a native button with accessible name `Reset active setup`.
- The review has a visible heading and `aria-label="Reset active setup review"`.
- Opening the review announces its availability politely without stealing
  focus.
- Confirm is the primary action; Cancel is non-destructive and returns focus to
  the Reset trigger.
- After Confirm, the existing keyboard-reachable pending Undo status follows in
  normal DOM order.
- Group headings, changed counts and current-to-default values remain readable
  without relying on color.
- Long monster, item and setting labels wrap. The review must not create page
  width overflow at the current compact landscape, tablet or mobile breakpoints.

## Required tests and validation

### Pure candidate and review tests

Prove that:

- the candidate is built from canonical defaults rather than current values or
  duplicated literals;
- target, selected style and setup mode are preserved;
- Melee, Ranged and Magic caches all reset and the selected top-level loadout
  matches its reset cache;
- levels, prayers, boosts, specials, manual combat overrides, Trip, Ring of
  Wealth and Planner targets reset;
- Default mode replaces `form` plus `defaultForm` without changing the custom
  map;
- Custom mode replaces only the current target's custom row and leaves
  `defaultForm` plus every other custom row unchanged;
- Dense and Cannon families are preserved;
- ordered review groups contain only changed fields, use display labels and do
  not double-count the active cache;
- an already-default setup is a no-op; and
- stale and duplicate candidate consumption is rejected.

### Transaction and browser tests

Prove that:

- opening and cancelling review cause no setter, persistence, unblock or Undo
  change;
- Confirm writes only `index-sim:rewrite-setup` and applies one complete
  candidate;
- session-only Confirm still applies the complete candidate and reports
  non-durability;
- Undo restores and persists the complete prior six-family setup;
- reload after durable Confirm restores the reset setup;
- reload after durable Undo restores the pre-reset setup;
- current target and selected style stay visible through Confirm;
- all saved Duel rows and unrelated custom setups survive Confirm, Undo and
  reload;
- Planner UI is not blanket-reset and any level-driven reconciliation follows
  its existing visible, persisted integrity rules;
- active PriceSet, manual item prices, shared/local history, loot, Cannon,
  Dense and Hiscores state remain byte- or semantic-equal as appropriate; and
- the review and actions remain keyboard-operable and contained at current
  responsive breakpoints.

Run at minimum during implementation:

```sh
npm run test -- src/tests/active-setup-reset.test.ts src/tests/active-setup-reset-review.test.tsx src/tests/ui-adapters.test.ts src/tests/planner-ui-state.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "Reset active setup"
npm run build
git diff --check
```

Run the complete functional browser suite before delivery because Setup actions,
the single pending Undo surface and persisted setup state are shared workflows.
Run visual comparison when the new review is added to a captured shell state.
No live provider, database, deployment or generated-data refresh is required.

## Acceptance criteria

- A user can start `Reset active setup` from the existing setup actions.
- Nothing changes before explicit confirmation.
- The review identifies the preserved target/style/owner and every changing
  setup group.
- The selected style remains selected and all three style caches reset to
  canonical defaults.
- Default/custom ownership follows the specified active-owner rules.
- Confirm persists and applies one complete validated rewrite setup.
- Undo restores the exact prior complete rewrite setup and persistence when
  available.
- Target, saved Duel setups, unrelated custom setups, Dense, Cannon, loot,
  PriceSet, manual item prices, histories and Hiscores remain protected.
- No setup, transfer, price, history, request or result schema changes.
- Focused state/component, persistence, architecture, browser, build and diff
  gates pass.

## Implementation evidence

- `src/app/state/active-setup-reset.ts` owns DOM-free candidate construction,
  Default/Custom replacement policy, grouped friendly review data, semantic
  six-family freshness, no-op detection and one-shot consumption.
- `src/app/components/shell/active-setup-reset-review.tsx`,
  `src/app/components/shell/workbench-shell.tsx`, `src/app/App.tsx` and
  `src/app/styles.css` own the accessible responsive review and the existing
  complete persistence-aware Apply/Undo integration.
- `src/tests/active-setup-reset.test.ts`,
  `src/tests/active-setup-reset-review.test.tsx`, `src/tests/ui-adapters.test.ts`
  and `src/tests/e2e/loadout.spec.ts` cover candidate ownership, labels,
  stale/no-op/one-shot behavior, persistence, protected state, durable reload
  and session-only Apply/Undo.
- The dated command results and local-runtime evidence are recorded in
  [the testing evidence log](../project/testing-evidence.md). They do not claim
  deployed or external-provider behavior.

## Open questions

None block implementation. Future changes to what the canonical starting setup
contains belong to the default-state owner and revision review, not to a second
reset-only default definition.
